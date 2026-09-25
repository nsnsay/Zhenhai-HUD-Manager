#!/usr/bin/env bun
/**
 * Overlay 打包器（唯一实现，供仓库内所有 Overlay 前端项目共用）。
 *
 * 归属：脚本属于 Overlay 前端项目（apps/Hai），其它 Overlay 项目用 `--project <dir>` 复用；
 * 由管理端的构建流程调用（apps/Zhen 的 `bun run pack:overlay`）。
 *
 * 一条命令做完：
 *   1. 解析目标项目与其 zhenhaiOverlay 元数据（package.json 是清单四个字段的唯一真源）；
 *   2. 缺少构建产物时自动构建（--build 可强制重跑）；
 *   3. 校验产物：入口文件、清单可解析、绝对路径资源引用告警；
 *   4. 生成清单：写入 name/description/author/version，其余键原样保留；
 *   5. 若声明了 installTo（内置 Overlay），把产物镜像到管理端 resources/ 下；
 *   6. 产出 <repo>/dist/<bundleName>-<version>.zip，并用管理端导入时同一套 zip 校验自检；
 *   7. 清理同前缀的历史 zip，最后打印一行汇总。
 *
 * 依赖解析：AdmZip 与共享校验器都来自管理端 apps/Zhen（它是本仓库 zip 的消费方）。
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOverlayManifest,
  overlayBundleZipName,
  parsePackArgs,
  resolveBundleConfig,
} from "../../Zhen/src/shared/overlay-bundle.ts";
import {
  OVERLAY_ENTRY_FILE,
  detectAbsoluteAssetRefs,
  parseOverlayManifest,
  slugifyOverlayId,
  validateZipEntries,
} from "../../Zhen/src/shared/overlays.ts";

/** 本脚本归属的 Overlay 项目：apps/Hai。 */
const defaultProjectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(defaultProjectDir, "..", "..");
/** 管理端 Electron 应用（apps/Zhen）：AdmZip 依赖与共享校验器的来源。 */
const appRoot = resolve(defaultProjectDir, "..", "Zhen");

const AdmZip = createRequire(join(appRoot, "package.json"))("adm-zip");

const DIST_DIR_NAME = "dist";
const MANIFEST_FILE = "overlay.json";
const DEFAULT_OUT_DIR = join(repoRoot, "dist");

function log(message) {
  console.log(`[pack-overlay] ${message}`);
}

function warn(message) {
  console.warn(`[pack-overlay] ${message}`);
}

function fail(message) {
  console.error(`[pack-overlay] ${message}`);
  process.exit(1);
}

function readJsonFile(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function usage() {
  return [
    "Usage: bun scripts/pack-overlay.mjs [options]",
    "",
    "Options:",
    "  --project <dir>   Overlay project to pack, relative to the current directory",
    "                    (defaults to the project this script lives in).",
    "  --version <v>     Override the version stamped into the manifest and bundle name.",
    "  --out <dir>       Directory for the zip, relative to the current directory",
    "                    (defaults to <repo>/dist).",
    "  --build           Rebuild even when a build already exists.",
    "  --no-zip          Only build, verify and install; do not write a zip.",
    "  -h, --help        Show this help.",
  ].join("\n");
}

/** AdmZip 条目是否为符号链接（与管理端导入校验保持一致）。 */
function isSymlinkEntry(entry) {
  if (entry.isDirectory) {
    return false;
  }

  return ((entry.attr >>> 16) & 0xf000) === 0xa000;
}

function countFiles(dir) {
  let total = 0;

  for (const name of readdirSync(dir)) {
    const target = join(dir, name);

    try {
      total += statSync(target).isDirectory() ? countFiles(target) : 1;
    } catch {
      // 忽略无法读取的条目
    }
  }

  return total;
}

/** 依赖 zhenhaiOverlay.versionFrom / 项目自身 version 解析版本号。 */
function resolveVersion(args, bundle, projectDir, projectPackage) {
  if (args.version) {
    return args.version;
  }

  if (bundle.versionFrom) {
    const sourceFile = resolve(projectDir, bundle.versionFrom);

    if (!existsSync(sourceFile)) {
      fail(`zhenhaiOverlay.versionFrom points to a missing file: ${sourceFile}`);
    }

    const source = readJsonFile(sourceFile);

    if (typeof source.version !== "string" || !source.version.trim()) {
      fail(`${relative(repoRoot, sourceFile)} has no version field.`);
    }

    log(`version ${source.version.trim()} ← ${relative(repoRoot, sourceFile)}`);
    return source.version.trim();
  }

  if (typeof projectPackage.version !== "string" || !projectPackage.version.trim()) {
    fail(
      `${relative(repoRoot, join(projectDir, "package.json"))} has no version field; pass --version.`,
    );
  }

  return projectPackage.version.trim();
}

function ensureBuild(args, projectDir, entryFile) {
  if (!args.forceBuild && existsSync(entryFile)) {
    return;
  }

  log(`building ${relative(repoRoot, projectDir)} …`);

  /**
   * 用单个命令字符串（而不是 args 数组）配合 shell：Windows 下才能解析
   * bun.cmd，同时避免 Node 24 对「shell + args」组合的 DEP0190 警告。
   * 命令是常量，不含任何外部输入。
   */
  const result = spawnSync("bun run build", {
    cwd: projectDir,
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    fail(`Failed to run "bun run build": ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`"bun run build" failed with exit code ${result.status}.`);
  }

  if (!existsSync(entryFile)) {
    fail(`Build finished but ${relative(repoRoot, entryFile)} is missing.`);
  }
}

/** 校验产物并按 package.json 元数据重写清单，返回写回的清单。 */
function stampManifest(distDir, bundle, version) {
  const entryFile = join(distDir, OVERLAY_ENTRY_FILE);
  const html = readFileSync(entryFile, "utf8");

  if (detectAbsoluteAssetRefs(html)) {
    warn(
      `${relative(repoRoot, entryFile)} references absolute asset paths; ` +
        "they will 404 when the bundle is served from /overlays/<id>/.",
    );

    html.split(/\r?\n/).forEach((line, index) => {
      if (/(?:src|href)\s*=\s*["']\/(?!\/)/i.test(line)) {
        warn(`  line ${index + 1}: ${line.trim().slice(0, 160)}`);
      }
    });
  }

  const manifestFile = join(distDir, MANIFEST_FILE);

  if (!existsSync(manifestFile)) {
    fail(`${relative(repoRoot, manifestFile)} is missing; every bundle needs a manifest.`);
  }

  const rawManifest = readFileSync(manifestFile, "utf8");
  let baseManifest;

  try {
    baseManifest = JSON.parse(rawManifest);
  } catch (error) {
    fail(`${relative(repoRoot, manifestFile)} is not valid JSON: ${error.message}`);
  }

  const built = buildOverlayManifest(baseManifest, bundle, version);

  if (!built.ok) {
    fail(built.error);
  }

  const text = `${JSON.stringify(built.value, null, 2)}\n`;
  writeFileSync(manifestFile, text, "utf8");

  const parsed = parseOverlayManifest(built.value, Buffer.byteLength(text, "utf8"));

  for (const warning of parsed.warnings) {
    warn(`${relative(repoRoot, manifestFile)}: ${warning}`);
  }

  log(
    `manifest name="${String(built.value.name)}" version="${String(built.value.version)}" ` +
      `→ overlayId ≈ ${slugifyOverlayId(String(built.value.name))}`,
  );

  return built.value;
}

/** 把产物镜像到管理端（仅内置 Overlay 声明 installTo 时）。 */
function installBundle(distDir, installTo, projectDir) {
  if (!installTo) {
    return null;
  }

  const target = resolve(projectDir, installTo);
  const resourcesRoot = join(appRoot, "resources");
  const targetRelative = relative(resourcesRoot, target);

  if (!targetRelative || targetRelative.startsWith("..") || isAbsolute(targetRelative)) {
    fail(`zhenhaiOverlay.installTo must point inside ${relative(repoRoot, resourcesRoot)}/.`);
  }

  log(`installing → ${relative(repoRoot, target)}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(distDir, target, { recursive: true });

  return target;
}

function pruneOldBundles(outDir, bundleName, keepName) {
  for (const name of readdirSync(outDir)) {
    if (name === keepName || !name.endsWith(".zip") || !name.startsWith(`${bundleName}-`)) {
      continue;
    }

    rmSync(join(outDir, name), { force: true });
    log(`removed stale bundle ${name}`);
  }
}

/** 产出 zip，并用管理端导入时的同一套校验自检。 */
function writeBundle(distDir, bundleName, version, outDir) {
  mkdirSync(outDir, { recursive: true });

  const zipName = overlayBundleZipName(bundleName, version);
  const target = join(outDir, zipName);
  const zip = new AdmZip();

  zip.addLocalFolder(distDir);
  zip.writeZip(target);

  const entries = zip.getEntries().map((entry) => ({
    entryName: entry.entryName,
    isDirectory: entry.isDirectory,
    uncompressedSize: entry.header.size,
    isSymlink: isSymlinkEntry(entry),
  }));

  const validation = validateZipEntries(entries);

  if (!validation.ok) {
    rmSync(target, { force: true });
    fail(`bundle failed the import validation (${validation.errorCode}): ${validation.error}`);
  }

  pruneOldBundles(outDir, bundleName, zipName);
  log(`bundle → ${relative(repoRoot, target)} (${entries.length} entries, ${statSync(target).size} bytes)`);

  return target;
}

function main() {
  const parsedArgs = parsePackArgs(process.argv.slice(2));

  if (!parsedArgs.ok) {
    fail(`${parsedArgs.error}\n\n${usage()}`);
  }

  const args = parsedArgs.value;

  if (args.help) {
    console.log(usage());
    return;
  }

  const projectDir = resolve(process.cwd(), args.project ?? defaultProjectDir);
  const packageFile = join(projectDir, "package.json");

  if (!existsSync(packageFile)) {
    fail(`No package.json found at ${packageFile}.`);
  }

  const projectPackage = readJsonFile(packageFile);
  const resolvedBundle = resolveBundleConfig(projectPackage, projectPackage.zhenhaiOverlay);

  if (!resolvedBundle.ok) {
    fail(`${relative(repoRoot, packageFile)}: ${resolvedBundle.error}`);
  }

  const bundle = resolvedBundle.value;
  const version = resolveVersion(args, bundle, projectDir, projectPackage);
  const distDir = join(projectDir, DIST_DIR_NAME);
  const entryFile = join(distDir, OVERLAY_ENTRY_FILE);

  ensureBuild(args, projectDir, entryFile);
  stampManifest(distDir, bundle, version);
  installBundle(distDir, bundle.installTo, projectDir);

  if (args.zip) {
    writeBundle(
      distDir,
      bundle.bundleName,
      version,
      resolve(process.cwd(), args.out ?? DEFAULT_OUT_DIR),
    );
  }

  log(
    `project=${relative(repoRoot, projectDir)} bundle=${bundle.bundleName} ` +
      `version=${version} files=${countFiles(distDir)}${args.zip ? "" : " (zip skipped)"}`,
  );
}

main();
