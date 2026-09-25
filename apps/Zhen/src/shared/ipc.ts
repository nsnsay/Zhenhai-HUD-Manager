import type { CollectionName } from "./collections";
import type { DevOverlayInput, OverlayEntry, OverlayManifest, OverlayState } from "./overlays";
import type { ShortcutBindings, ShortcutRegistrationMap } from "./shortcuts";

export type { CollectionName } from "./collections";
export { COLLECTION_NAMES, isCollectionName } from "./collections";
export type {
  ShortcutAction,
  ShortcutBindings,
  ShortcutRegistration,
  ShortcutRegistrationMap,
} from "./shortcuts";
export type {
  DevOverlayInput,
  OverlayEntry,
  OverlayErrorCode,
  OverlayManifest,
  OverlayShortcutDefinition,
  OverlaySource,
  OverlayState,
} from "./overlays";

export interface CrudResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
  };
}

export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: {
    field: string;
    order?: "asc" | "desc";
  };
  limit?: number;
  offset?: number;
}

export interface DatabaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface AppResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
  /** 可本地化的错误码（管理端界面用它翻译，error 作为兜底文案）。 */
  errorCode?: string;
}

export type LoggerLevel = "error" | "warn" | "info" | "debug";

export interface LoggerPayload {
  level: LoggerLevel;
  source: string;
  message: string;
  meta?: unknown;
}

export type UpdaterEventType =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdaterEventPayload {
  type: UpdaterEventType;
  version?: string;
  percent?: number;
  error?: string;
}

export interface UpdateCheckResult {
  success: boolean;
  updateAvailable?: boolean;
  version?: string;
  error?: string;
}

export interface ServerBinding {
  host: string;
  port: number;
}

export type WindowMaterial = "none" | "acrylic" | "mica";
export type NativeThemeSource = "system" | "light" | "dark";

export type OverlayLifecycleState = "shown" | "hidden" | "closing" | "closed";

export interface OverlayShortcutResult {
  id: string;
  accelerator: string;
  success: boolean;
  error?: string;
}

export interface OverlaySettingsPayload {
  overlayId: string;
  manifest: OverlayManifest;
  warnings: string[];
  settings: Record<string, unknown>;
  shortcutBindings: Record<string, string>;
  shortcutResults: OverlayShortcutResult[];
  canEdit: boolean;
}

export interface OverlayShortcutEvent {
  overlayId: string;
  shortcutId: string;
  timestamp: number;
}

export interface WindowAPI {
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  setWindowMaterial: (material: WindowMaterial) => Promise<boolean>;
  setThemeSource: (theme: NativeThemeSource) => Promise<boolean>;

  mainWindowDevtoolsToggle: () => Promise<boolean>;

  overlayCreate: () => Promise<boolean>;
  overlayClose: () => Promise<boolean>;
  overlayDevtoolsToggle: () => Promise<boolean>;
  /** 当前 Overlay 是否处于鼠标穿透状态（窗口未打开时返回会话默认值 true）。 */
  overlayGetIgnoreMouseEvents: () => Promise<boolean>;

  onOverlayLifecycle: (callback: (state: OverlayLifecycleState) => void) => () => void;
  onOverlayIgnoreMouseChanged: (callback: (enabled: boolean) => void) => () => void;

  db: {
    create: (
      collection: CollectionName,
      data: Record<string, unknown>,
    ) => Promise<CrudResult<DatabaseRecord>>;
    read: (collection: CollectionName, id: string) => Promise<CrudResult<DatabaseRecord>>;
    list: (
      collection: CollectionName,
      options?: QueryOptions,
    ) => Promise<CrudResult<DatabaseRecord[]>>;
    update: (
      collection: CollectionName,
      id: string,
      data: Record<string, unknown>,
    ) => Promise<CrudResult<DatabaseRecord>>;
    delete: (collection: CollectionName, id: string) => Promise<CrudResult<{ id: string }>>;
  };

  file: {
    save: (base64: string, fileName: string, category: string) => Promise<CrudResult<string>>;
    delete: (relativePath: string) => Promise<CrudResult<{ deleted: boolean }>>;
  };

  shortcut: {
    /** 注册全部动作，返回逐动作的成功/失败结果。 */
    register: (bindings: ShortcutBindings) => Promise<ShortcutRegistrationMap>;
    /** 当前真正生效的动作绑定。 */
    get: () => Promise<ShortcutBindings>;
  };

  app: {
    /** 应用版本号。 */
    getVersion: () => Promise<string>;
    getCs2Path: () => Promise<AppResult<string>>;
    selectDirectory: () => Promise<AppResult<string | null>>;
    installCfg: (cs2Path: string) => Promise<AppResult<string>>;
    /** 应用「允许局域网访问」设置（立即重新监听）。 */
    applyNetworkSettings: (allowLanAccess: boolean) => Promise<AppResult<ServerBinding>>;
  };

  overlay: {
    /** 当前 Overlay 列表 + 选中项 + 窗口状态。 */
    getState: () => Promise<OverlayState>;
    /** 弹文件选择器导入 zip（渲染端负责先做风险确认）。 */
    importZip: () => Promise<AppResult<OverlayEntry>>;
    remove: (overlayId: string) => Promise<AppResult<{ overlayId: string }>>;
    select: (overlayId: string) => Promise<AppResult<{ selectedId: string }>>;
    open: (overlayId?: string) => Promise<boolean>;
    /** 按当前选中项刷新已打开的 Overlay 窗口。 */
    reload: () => Promise<boolean>;
    reveal: (overlayId: string) => Promise<boolean>;
    addDevEntry: (input: DevOverlayInput) => Promise<AppResult<OverlayEntry>>;
    /** 读取该 Overlay 的清单、用户值与快捷键绑定。 */
    getSettings: (overlayId: string) => Promise<AppResult<OverlaySettingsPayload>>;
    /** 保存用户值 + 改键（内置条目不可保存）。 */
    saveSettings: (
      overlayId: string,
      payload: { settings: Record<string, unknown>; shortcutBindings: Record<string, string> },
    ) => Promise<AppResult<{ shortcutResults: OverlayShortcutResult[] }>>;
    /** 清除该 Overlay 的用户值与改键，回到清单默认。 */
    resetSettings: (overlayId: string) => Promise<AppResult<{ overlayId: string }>>;
    /** 该 Overlay 声明的快捷键被按下（Socket.IO 与 IPC 双通道）。 */
    onShortcut: (callback: (event: OverlayShortcutEvent) => void) => () => void;
    removeDevEntry: (overlayId: string) => Promise<AppResult<{ overlayId: string }>>;
    onStateChanged: (callback: (state: OverlayState) => void) => () => void;
  };

  logger: {
    log: (payload: LoggerPayload) => Promise<boolean>;
    read: (limit?: number) => Promise<string>;
  };

  updater: {
    checkForUpdates: () => Promise<UpdateCheckResult>;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    installUpdate: () => Promise<boolean>;
    onEvent: (callback: (event: UpdaterEventPayload) => void) => () => void;
  };
}
