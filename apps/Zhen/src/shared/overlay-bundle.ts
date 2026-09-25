/**
 * Overlay 打包器的纯逻辑。
 *
 * 这些函数同时被 `apps/Hai/scripts/pack-overlay.mjs`（打包入口）与单元测试使用，
 * 不依赖 Electron、DOM 与文件系统，便于直接单测。
 *
 * 约定：Overlay 项目在自己的 package.json 里用 `zhenhaiOverlay` 声明打包元数据，
 * 清单里与项目元数据重叠的四个字段（name/description/author/version）以 package.json 为唯一真源。
 */

export interface ZhenhaiOverlayConfig {
  /** zip 产物名前缀，例如 `zhenhai-default`。缺省由包名推导为 `zhenhai-<name>`。 */
  bundleName?: string;
  /** 写入清单 `name`，同时也是管理端导入后的展示名。必填。 */
  displayName?: string;
  /** 写入清单 `description`。 */
  description?: string;
  /** 写入清单 `author`。缺省取 package.json 顶层的 author。 */
  author?: string;
  /** 版本号来源：指向某个 package.json 的相对路径（例如随包发布的 Overlay 用 `../Zhen/package.json`）。 */
  versionFrom?: string;
  /** 构建后额外镜像到的目录，相对项目目录；必须位于 `apps/Zhen/resources` 之下。 */
  installTo?: string;
}

export interface ResolvedBundleConfig {
  bundleName: string;
  displayName: string;
  description?: string;
  author?: string;
  versionFrom?: string;
  installTo?: string;
}

/** 打包器从项目 package.json 里取到的字段。 */
export interface OverlayProjectPackage {
  name?: unknown;
  author?: unknown;
}

export interface PackArgs {
  /** 目标 Overlay 项目目录（相对当前 cwd）；缺省为打包脚本所属项目。 */
  project?: string;
  /** 显式覆盖版本号。 */
  version?: string;
  /** zip 输出目录（相对当前 cwd）；缺省为仓库根目录 dist/。 */
  out?: string;
  /** 强制重新构建；缺省仅在缺少构建产物时构建。 */
  forceBuild: boolean;
  /** 是否产出 zip；`--no-zip` 时只构建/校验/安装。 */
  zip: boolean;
  help: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const BUNDLE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const JSON_PACKAGE_FILE = "package.json";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `@zhenhai/hai` → `hai`；`Nagehehe` → `nagehehe`。 */
export function bundleNameFromPackageName(packageName: string): string {
  const scopeFreeName = readText(packageName).split("/").pop() ?? "";
  const slug = scopeFreeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `zhenhai-${slug}` : "zhenhai-overlay";
}

export function overlayBundleZipName(bundleName: string, version: string): string {
  return `${bundleName}-${version}.zip`;
}

/**
 * 解析命令行参数。
 *
 * 未知参数直接报错，避免把拼错的参数静默当成默认行为。
 */
export function parsePackArgs(argv: readonly string[]): Result<PackArgs> {
  const args: PackArgs = { forceBuild: false, zip: true, help: false };

  const readValue = (option: string, index: number): Result<string> => {
    const value = argv[index + 1];

    if (value === undefined || value.startsWith("-")) {
      return { ok: false, error: `${option} requires a value.` };
    }

    return { ok: true, value };
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index] ?? "";

    if (option === "--help" || option === "-h") {
      args.help = true;
      continue;
    }

    if (option === "--build") {
      args.forceBuild = true;
      continue;
    }

    if (option === "--no-zip") {
      args.zip = false;
      continue;
    }

    if (option === "--project" || option === "--version" || option === "--out") {
      const result = readValue(option, index);

      if (!result.ok) {
        return result;
      }

      if (option === "--project") args.project = result.value;
      if (option === "--version") args.version = result.value;
      if (option === "--out") args.out = result.value;

      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${option}` };
  }

  return { ok: true, value: args };
}

/** 把 package.json 的 `name`/`author` 与 `zhenhaiOverlay` 收敛成可直接使用的配置。 */
export function resolveBundleConfig(
  packageMeta: OverlayProjectPackage,
  rawConfig: unknown,
): Result<ResolvedBundleConfig> {
  const config = isPlainObject(rawConfig) ? rawConfig : {};

  const explicitBundleName = readText(config.bundleName);
  const bundleName = explicitBundleName || bundleNameFromPackageName(readText(packageMeta.name));

  if (!BUNDLE_NAME_PATTERN.test(bundleName)) {
    return {
      ok: false,
      error: `Invalid zhenhaiOverlay.bundleName "${bundleName}"; expected lowercase letters, digits and dashes.`,
    };
  }

  const displayName = readText(config.displayName);

  if (!displayName) {
    return {
      ok: false,
      error:
        "Missing zhenhaiOverlay.displayName; it is written into the overlay manifest name.",
    };
  }

  const versionFrom = readText(config.versionFrom);

  if (versionFrom && !isRelativePackageJsonPath(versionFrom)) {
    return {
      ok: false,
      error: `Invalid zhenhaiOverlay.versionFrom "${versionFrom}"; expected a relative path ending in ${JSON_PACKAGE_FILE}.`,
    };
  }

  const installTo = readText(config.installTo);

  if (installTo && !isRelativePath(installTo)) {
    return {
      ok: false,
      error: `Invalid zhenhaiOverlay.installTo "${installTo}"; expected a relative path.`,
    };
  }

  return {
    ok: true,
    value: {
      bundleName,
      displayName,
      description: readText(config.description) || undefined,
      author: readText(config.author) || readText(packageMeta.author) || undefined,
      versionFrom: versionFrom || undefined,
      installTo: installTo || undefined,
    },
  };
}

/**
 * 生成要写回产物的清单：只覆写 name/description/author/version，其余键（manifestVersion、
 * homepage、settings、override、shortcuts 等）原样保留。
 */
export function buildOverlayManifest(
  base: unknown,
  config: ResolvedBundleConfig,
  version: string,
): Result<Record<string, unknown>> {
  if (!isPlainObject(base)) {
    return { ok: false, error: "overlay.json must be a JSON object." };
  }

  if (!VERSION_PATTERN.test(version)) {
    return {
      ok: false,
      error: `Invalid version "${version}"; expected letters, digits, dots, dashes, underscores or plus signs.`,
    };
  }

  const manifest: Record<string, unknown> = { ...base, name: config.displayName, version };

  if (config.description) {
    manifest.description = config.description;
  } else {
    delete manifest.description;
  }

  if (config.author) {
    manifest.author = config.author;
  } else {
    delete manifest.author;
  }

  return { ok: true, value: manifest };
}

export function isRelativePath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");

  return Boolean(normalized) && !normalized.startsWith("/") && !/^[A-Za-z]:/.test(normalized);
}

export function isRelativePackageJsonPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");

  return (
    isRelativePath(value) &&
    (normalized === JSON_PACKAGE_FILE || normalized.endsWith(`/${JSON_PACKAGE_FILE}`))
  );
}
