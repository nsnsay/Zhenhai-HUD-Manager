
/**
 * Overlay 注册表的共享类型与纯函数。
 *
 * 这些函数同时被主进程（导入校验、URL 解析）与单元测试使用，
 * 不依赖 Electron 与 DOM。
 */
export type OverlaySource = "builtin" | "imported" | "dev";

export interface OverlayEntry {
  overlayId: string;
  name: string;
  source: OverlaySource;
  /** builtin / imported：入口文件相对路径（默认 index.html）。 */
  entryFile?: string;
  /** dev：开发服务器基础地址。 */
  url?: string;
  /** dev：可选路由，支持 "#/x" 与 "/x" 两种写法。 */
  route?: string;
  version?: string;
  author?: string;
  description?: string;
  /** 清单声明（每次启动 / 打开设置面板时从磁盘重读）。 */
  manifest?: OverlayManifest;
  /** 用户在应用内为该 Overlay 修改过的设置值。 */
  settings?: Record<string, unknown>;
  /** 用户为该 Overlay 改过的快捷键绑定（shortcutId → accelerator）。 */
  shortcutBindings?: Record<string, string>;
  fileCount?: number;
  /** 导入时检测到 index.html 引用了绝对路径资源。 */
  absoluteAssetWarning?: boolean;
}

export interface OverlayState {
  entries: OverlayEntry[];
  selectedId: string;
  isDev: boolean;
  isOpen: boolean;
  ignoreMouseEvents: boolean;
}

export interface DevOverlayInput {
  name: string;
  url: string;
  route?: string;
}

export const DEFAULT_OVERLAY_ID = "default";
export const OVERLAY_ENTRY_FILE = "index.html";
/** 读取顺序：新标准 overlay.json 优先，兼容旧的 zhenhai.overlay.json。 */
export const OVERLAY_MANIFEST_FILES = ["overlay.json", "zhenhai.overlay.json"] as const;

/** @deprecated 兼容旧引用；新代码请用 OVERLAY_MANIFEST_FILES。 */
export const OVERLAY_MANIFEST_FILE = OVERLAY_MANIFEST_FILES[1];

export const OVERLAY_MANIFEST_LIMITS = {
  maxBytes: 64 * 1024,
  maxSettingsKeys: 64,
  maxShortcuts: 16,
} as const;

const SETTINGS_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const SHORTCUT_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const MODIFIER_PATTERN = /(commandorcontrol|cmdorctrl|ctrl|control|alt|shift|super|meta|cmd)\+/i;

/** zip 解压安全上限。 */
export const OVERLAY_ZIP_LIMITS = {
  maxEntries: 5000,
  maxTotalBytes: 512 * 1024 * 1024,
  maxEntryBytes: 256 * 1024 * 1024,
  maxPathLength: 240,
} as const;

export type OverlayErrorCode =
  | "zip_unreadable"
  | "zip_unsafe_entry"
  | "zip_symlink"
  | "zip_too_many_entries"
  | "zip_too_large"
  | "zip_no_index_html"
  | "zip_extract_failed"
  | "overlay_not_found"
  | "overlay_delete_failed"
  | "dev_url_invalid"
  | "dev_route_invalid"
  | "dev_disabled"
  | "settings_write_failed"
  | "reveal_failed"
  | "manifest_invalid"
  | "shortcut_conflict";

export interface ZipEntryLike {
  entryName: string;
  isDirectory: boolean;
  uncompressedSize?: number;
  isSymlink?: boolean;
}

export interface ZipValidationResult {
  ok: boolean;
  errorCode?: OverlayErrorCode;
  error?: string;
}

/** "My Overlay v2.zip" → "my-overlay-v2"。 */
export function slugifyOverlayId(input: string): string {
  const slug = input
    .replace(/\.zip$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "overlay";
}

export function nextAvailableOverlayId(base: string, taken: readonly string[]): string {
  const used = new Set(taken);

  if (!used.has(base)) {
    return base;
  }

  for (let index = 2; index < 1000; index++) {
    const candidate = `${base}-${index}`;

    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

/** Overlay id 白名单：仅允许小写字母、数字与连字符（防止路径穿越）。 */
export function isSafeOverlayId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

export function validateZipEntries(entries: readonly ZipEntryLike[]): ZipValidationResult {
  if (entries.length > OVERLAY_ZIP_LIMITS.maxEntries) {
    return {
      ok: false,
      errorCode: "zip_too_many_entries",
      error: `Zip contains too many entries (${entries.length} > ${OVERLAY_ZIP_LIMITS.maxEntries}).`,
    };
  }

  let totalBytes = 0;

  for (const entry of entries) {
    const name = entry.entryName.replace(/\\/g, "/");

    if (
      name.length > OVERLAY_ZIP_LIMITS.maxPathLength ||
      name.startsWith("/") ||
      /^[a-zA-Z]:/.test(name) ||
      name.includes("\0") ||
      name.split("/").some((segment) => segment === "..")
    ) {
      return {
        ok: false,
        errorCode: "zip_unsafe_entry",
        error: `Zip contains an unsafe path: ${entry.entryName}`,
      };
    }

    if (entry.isSymlink) {
      return {
        ok: false,
        errorCode: "zip_symlink",
        error: `Zip contains a symbolic link: ${entry.entryName}`,
      };
    }

    const size = entry.uncompressedSize ?? 0;

    if (size > OVERLAY_ZIP_LIMITS.maxEntryBytes) {
      return {
        ok: false,
        errorCode: "zip_too_large",
        error: `Zip entry is too large: ${entry.entryName}`,
      };
    }

    totalBytes += size;
  }

  if (totalBytes > OVERLAY_ZIP_LIMITS.maxTotalBytes) {
    return {
      ok: false,
      errorCode: "zip_too_large",
      error: `Zip uncompressed size is too large (${totalBytes} bytes).`,
    };
  }

  return { ok: true };
}

/** index.html 是否引用了以 / 开头的绝对资源（子路径下会 404）。 */
export function detectAbsoluteAssetRefs(html: string): boolean {
  return /(?:src|href)\s*=\s*["']\/(?!\/)/i.test(html);
}

export function normalizeDevUrl(url: string): string | null {
  const trimmed = url?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/** 把开发地址与路由拼接：路由以 # 开头走 hash，否则作为路径拼接。 */
export function joinOverlayRoute(url: string, route?: string): string {
  const base = url.replace(/\/+$/, "");
  const suffix = route?.trim();

  if (!suffix) {
    return `${base}/`;
  }

  if (suffix.startsWith("#")) {
    return `${base}/${suffix}`;
  }

  return `${base}/${suffix.replace(/^\/+/, "")}`;
}

/**
 * 解析条目最终 URL。
 *
 * origin 由调用方传入（shared/server.ts 的 serverOrigin()），
 * 让本模块保持零运行时依赖，可在 node --test 下直接单测。
 */
/**
 * 条目对应的访问路径：
 * - 默认内置：/overlay/（与 Hai 的 Vite base 一致）
 * - 其它内置 / 导入：/overlays/<id>/
 * - 开发：完整 URL（含可选路由）
 */
export function overlayPath(entry: OverlayEntry): string {
  if (entry.source === "dev") {
    const base = normalizeDevUrl(entry.url ?? "");

    return base ? joinOverlayRoute(base, entry.route) : "";
  }

  const entryFile = entry.entryFile && entry.entryFile !== OVERLAY_ENTRY_FILE ? entry.entryFile : "";

  // 默认内置由 Hai 构建、Vite base 固定为 /overlay/；
  // 若改挂到 /overlays/default/，其 vue-router 会按字符剥离 base 前缀而请求到 /overlay/s/default/。
  if (entry.source === "builtin" && entry.overlayId === DEFAULT_OVERLAY_ID) {
    return `/overlay/${entryFile}`;
  }

  return `/overlays/${entry.overlayId}/${entryFile}`;
}

export function resolveOverlayUrl(entry: OverlayEntry, origin: string): string {
  const path = overlayPath(entry);

  if (!path) {
    return origin;
  }

  return /^https?:\/\//i.test(path) ? path : `${origin}${path}`;
}
export interface OverlayShortcutDefinition {
  id: string;
  name: string;
  /** 清单声明的默认加速键，例如 CommandOrControl+Alt+S。 */
  default: string;
  description?: string;
}

/** overlay.json 自声明文件的结构。 */
export interface OverlayManifest {
  manifestVersion?: number;
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  homepage?: string;
  /** 可编辑设置：清单默认值，用户可在应用内修改。 */
  settings?: Record<string, unknown>;
  /** 强制覆盖：始终胜过应用设置与用户修改。 */
  override?: Record<string, unknown>;
  shortcuts?: OverlayShortcutDefinition[];
}

export interface ParsedOverlayManifest {
  manifest: OverlayManifest;
  warnings: string[];
}

function canonicalizeAccelerator(accelerator: string): string {
  return accelerator.split("+").map((part) => part.trim().toLowerCase()).filter(Boolean).join("+");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSettingsMap(input: unknown, warnings: string[], label: string): Record<string, unknown> {
  if (input === undefined) return {};

  if (!isPlainObject(input)) {
    warnings.push(`${label} must be an object and was ignored.`);
    return {};
  }

  const entries = Object.entries(input);

  if (entries.length > OVERLAY_MANIFEST_LIMITS.maxSettingsKeys) {
    warnings.push(`${label} exceeds ${OVERLAY_MANIFEST_LIMITS.maxSettingsKeys} keys; extra keys were ignored.`);
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of entries.slice(0, OVERLAY_MANIFEST_LIMITS.maxSettingsKeys)) {
    if (!SETTINGS_KEY_PATTERN.test(key)) {
      warnings.push(`${label}.${key} has an invalid key name and was ignored.`);
      continue;
    }

    result[key] = value;
  }

  return result;
}

/** 解析 overlay.json（纯函数）。非法/超限内容降级为 warning 而不是整体失败。 */
export function parseOverlayManifest(raw: unknown, sizeBytes = 0): ParsedOverlayManifest {
  const warnings: string[] = [];

  if (sizeBytes > OVERLAY_MANIFEST_LIMITS.maxBytes) {
    return { manifest: {}, warnings: [`Manifest exceeds ${OVERLAY_MANIFEST_LIMITS.maxBytes} bytes.`] };
  }

  if (!isPlainObject(raw)) {
    return { manifest: {}, warnings: ["Manifest must be a JSON object."] };
  }

  const manifest: OverlayManifest = {};

  if (typeof raw.manifestVersion === "number") manifest.manifestVersion = raw.manifestVersion;
  if (typeof raw.name === "string" && raw.name.trim()) manifest.name = raw.name.trim();
  if (typeof raw.description === "string") manifest.description = raw.description;
  if (typeof raw.version === "string") manifest.version = raw.version;
  if (typeof raw.author === "string") manifest.author = raw.author;
  if (typeof raw.homepage === "string") manifest.homepage = raw.homepage;

  const settings = sanitizeSettingsMap(raw.settings, warnings, "settings");
  const override = sanitizeSettingsMap(raw.override, warnings, "override");

  if (Object.keys(settings).length > 0) manifest.settings = settings;
  if (Object.keys(override).length > 0) manifest.override = override;

  if (raw.shortcuts !== undefined) {
    if (!Array.isArray(raw.shortcuts)) {
      warnings.push("shortcuts must be an array and was ignored.");
    } else {
      const shortcuts: OverlayShortcutDefinition[] = [];
      const seenIds = new Set<string>();
      const seenAccelerators = new Set<string>();

      if (raw.shortcuts.length > OVERLAY_MANIFEST_LIMITS.maxShortcuts) {
        warnings.push(`shortcuts exceeds ${OVERLAY_MANIFEST_LIMITS.maxShortcuts} entries; extra entries were ignored.`);
      }

      for (const item of raw.shortcuts.slice(0, OVERLAY_MANIFEST_LIMITS.maxShortcuts)) {
        if (!isPlainObject(item)) {
          warnings.push("A shortcut entry is not an object and was ignored.");
          continue;
        }

        const id = typeof item.id === "string" ? item.id.trim() : "";
        const accelerator = typeof item.default === "string" ? item.default.trim() : "";
        const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : id;

        if (!SHORTCUT_ID_PATTERN.test(id)) {
          warnings.push(`Shortcut id "${id}" is invalid and was ignored.`);
          continue;
        }

        if (seenIds.has(id)) {
          warnings.push(`Duplicate shortcut id "${id}" was ignored.`);
          continue;
        }

        if (!accelerator || !MODIFIER_PATTERN.test(accelerator)) {
          warnings.push(`Shortcut "${id}" needs a modifier (Ctrl/Alt/Shift/Super) and was ignored.`);
          continue;
        }

        const canonical = canonicalizeAccelerator(accelerator);

        if (seenAccelerators.has(canonical)) {
          warnings.push(`Shortcut "${id}" reuses ${accelerator} and was ignored.`);
          continue;
        }

        seenIds.add(id);
        seenAccelerators.add(canonical);
        shortcuts.push({
          id,
          name,
          default: accelerator,
          description: typeof item.description === "string" ? item.description : undefined,
        });
      }

      if (shortcuts.length > 0) manifest.shortcuts = shortcuts;
    }
  }

  return { manifest, warnings };
}

export interface EffectiveSettingsSource {
  manifest?: OverlayManifest;
  settings?: Record<string, unknown>;
  shortcutBindings?: Record<string, string>;
}

/**
 * 合成「发给 Overlay 的设置」。
 *
 * 优先级（后者覆盖前者）：app-settings → 清单默认 → 用户修改 → 清单强制覆盖；
 * extras 按键级合并，避免整对象替换。
 */
export function composeEffectiveSettings(
  appSettings: Record<string, unknown> | undefined | null,
  overlay: EffectiveSettingsSource | null | undefined,
): Record<string, unknown> | undefined {
  const base = isPlainObject(appSettings) ? { ...appSettings } : {};
  const manifestSettings = overlay?.manifest?.settings ?? {};
  const userSettings = overlay?.settings ?? {};
  const forced = overlay?.manifest?.override ?? {};

  if (
    Object.keys(base).length === 0 &&
    Object.keys(manifestSettings).length === 0 &&
    Object.keys(userSettings).length === 0 &&
    Object.keys(forced).length === 0
  ) {
    return undefined;
  }

  const extras = {
    ...(isPlainObject(base.extras) ? base.extras : {}),
    ...(isPlainObject(manifestSettings.extras) ? manifestSettings.extras : {}),
    ...(isPlainObject(userSettings.extras) ? userSettings.extras : {}),
    ...(isPlainObject(forced.extras) ? forced.extras : {}),
  };

  const result: Record<string, unknown> = {
    ...base,
    ...manifestSettings,
    ...userSettings,
    ...forced,
  };

  if (Object.keys(extras).length > 0) {
    result.extras = extras;
  }

  return result;
}

/** 清单声明 + 用户改键后的最终快捷键绑定。 */
export function resolveShortcutBindings(
  overlay: EffectiveSettingsSource | null | undefined,
): Record<string, string> {
  const bindings: Record<string, string> = {};

  for (const shortcut of overlay?.manifest?.shortcuts ?? []) {
    bindings[shortcut.id] = shortcut.default;
  }

  for (const [id, accelerator] of Object.entries(overlay?.shortcutBindings ?? {})) {
    if (accelerator && accelerator.trim()) {
      bindings[id] = accelerator.trim();
    }
  }

  return bindings;
}