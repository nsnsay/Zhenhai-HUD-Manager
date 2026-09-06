export type CollectionName = "extras" | "players" | "teams" | "matchs" | "tournaments";

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

export type WindowMaterial = "none" | "acrylic" | "mica";
export type NativeThemeSource = "system" | "light" | "dark";

export interface WindowAPI {
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  setWindowMaterial: (material: WindowMaterial) => Promise<boolean>;
  setThemeSource: (theme: NativeThemeSource) => Promise<boolean>;

  mainWindowDevtoolsToggle: () => Promise<boolean>;

  overlayCreate: () => Promise<boolean>;
  overlayClose: () => Promise<boolean>;
  overlayWatchStatus: (enabled: boolean) => Promise<boolean>;
  overlayDevtoolsToggle: () => Promise<boolean>;

  onOverlayLifecycle: (callback: (state: string) => void) => () => void;

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
    register: (accelerator: string) => Promise<{ success: boolean; accelerator: string }>;
    get: () => Promise<string>;
  };

  app: {
    getCs2Path: () => Promise<AppResult<string>>;
    selectDirectory: () => Promise<AppResult<string | null>>;
    installCfg: (cs2Path: string) => Promise<AppResult<string>>;
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
