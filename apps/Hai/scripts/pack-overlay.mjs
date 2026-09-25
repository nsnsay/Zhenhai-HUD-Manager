/**
 * 把构建好的 Overlay（apps/Zhen/resources/overlay）压成可再分发的 zip。
 *
 * 归属：脚本属于 Overlay 前端项目（apps/Hai），因此放在 apps/Hai/scripts；
 * 由管理端的构建流程调用（apps/Zhen 的 `bun run pack:overlay`）。
 *
 * - 生成前把 apps/Zhen/package.json 的版本号写入产物里的 overlay.json（单一版本来源）；
 * - 输出到仓库根目录 dist/zhenhai-default-<version>.zip：仅作为可再分发的资源包存在，
 *   electron-builder 不引用该目录，因此绝不会被打进 Electron 安装包；
 *   用户可以直接用「导入 Overlay (.zip)」重新导入。
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Overlay 前端项目（apps/Hai）：本脚本的归属。 */
const overlayProjectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(overlayProjectRoot, "..", "..");
/** 管理端 Electron 应用（apps/Zhen）：Overlay 构建产物与版本号的来源。 */
const appRoot = resolve(overlayProjectRoot, "..", "Zhen");

/**
 * adm-zip 从管理端解析。
 *
 * 本脚本消费的是管理端的构建产物与版本号，本来就必须依赖 apps/Zhen；
 * 因此复用它已声明的 adm-zip，而不是在 Overlay 项目里再声明一份。
 */
const AdmZip = createRequire(join(appRoot, "package.json"))("adm-zip");

const overlayDir = join(appRoot, "resources", "overlay");
/** 产物目录：仓库根目录 dist/，与 Electron 打包产物彼此独立。 */
const bundlesDir = join(repoRoot, "dist");
const bundlePrefix = "zhenhai-default";

if (!existsSync(join(overlayDir, "index.html"))) {
  console.error("[pack-overlay] resources/overlay/index.html not found — build apps/Hai first.");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
const manifestPath = join(overlayDir, "overlay.json");

if (!existsSync(manifestPath)) {
  console.error("[pack-overlay] overlay.json missing in the built overlay — build apps/Hai first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

mkdirSync(bundlesDir, { recursive: true });

for (const name of readdirSync(bundlesDir)) {
  if (name.startsWith(`${bundlePrefix}-`) && name.endsWith(".zip")) {
    rmSync(join(bundlesDir, name), { force: true });
  }
}

const zip = new AdmZip();
zip.addLocalFolder(overlayDir);

const target = join(bundlesDir, `${bundlePrefix}-${version}.zip`);
zip.writeZip(target);

console.log(`[pack-overlay] ${relative(repoRoot, target)} (${statSync(target).size} bytes)`);
