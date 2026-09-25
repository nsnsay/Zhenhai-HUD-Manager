import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type {
  CollectionName,
  DevOverlayInput,
  LoggerPayload,
  OverlayLifecycleState,
  OverlayShortcutEvent,
  OverlayState,
  QueryOptions,
  ShortcutBindings,
  UpdaterEventPayload,
  WindowAPI,
} from "../shared/ipc";

function writeLog(
  level: "error" | "warn" | "info" | "debug",
  source: string,
  message: string,
  meta?: unknown,
): void {
  ipcRenderer.invoke("logger:write", { level, source, message, meta }).catch(() => {
    // Ignore logging failures; the app should not depend on the logger.
  });
}

const api: WindowAPI = {
  windowMinimize: () => ipcRenderer.invoke("main-window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("main-window:maximize"),
  windowClose: () => ipcRenderer.invoke("main-window:close"),
  setWindowMaterial: (material) =>
    ipcRenderer.invoke("main-window:set-background-material", material),
  setThemeSource: (theme) => ipcRenderer.invoke("main-window:set-theme-source", theme),

  mainWindowDevtoolsToggle: () => ipcRenderer.invoke("main-window:toggle-devtools"),

  overlayCreate: () => ipcRenderer.invoke("overlay:create"),
  overlayClose: () => ipcRenderer.invoke("overlay:close"),
  overlayDevtoolsToggle: () => ipcRenderer.invoke("overlay:toggle-devtools"),
  overlayGetIgnoreMouseEvents: () => ipcRenderer.invoke("overlay:get-ignore-mouse-events"),

  onOverlayLifecycle: (callback: (state: OverlayLifecycleState) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      state: OverlayLifecycleState,
    ): void => callback(state);
    ipcRenderer.on("overlay:lifecycle", subscription);
    return (): void => {
      ipcRenderer.removeListener("overlay:lifecycle", subscription);
    };
  },

  onOverlayIgnoreMouseChanged: (callback: (enabled: boolean) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, enabled: boolean): void =>
      callback(enabled);
    ipcRenderer.on("overlay:ignore-mouse-changed", subscription);
    return (): void => {
      ipcRenderer.removeListener("overlay:ignore-mouse-changed", subscription);
    };
  },

  db: {
    create: (collection: CollectionName, data: Record<string, unknown>) =>
      ipcRenderer.invoke("db:create", collection, data),
    read: (collection: CollectionName, id: string) => ipcRenderer.invoke("db:read", collection, id),
    list: (collection: CollectionName, options?: QueryOptions) =>
      ipcRenderer.invoke("db:list", collection, options),
    update: (collection: CollectionName, id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke("db:update", collection, id, data),
    delete: (collection: CollectionName, id: string) =>
      ipcRenderer.invoke("db:delete", collection, id),
  },

  file: {
    save: (base64: string, fileName: string, category: string) =>
      ipcRenderer.invoke("file:save", base64, fileName, category),
    delete: (relativePath: string) => ipcRenderer.invoke("file:delete", relativePath),
  },

  shortcut: {
    register: (bindings: ShortcutBindings) => ipcRenderer.invoke("shortcut:register", bindings),
    get: () => ipcRenderer.invoke("shortcut:get"),
  },

  app: {
    getVersion: () => ipcRenderer.invoke("app:get-version"),
    getCs2Path: () => ipcRenderer.invoke("app:get-cs2-path"),
    selectDirectory: () => ipcRenderer.invoke("app:select-directory"),
    installCfg: (cs2Path: string) => ipcRenderer.invoke("app:install-cfg", cs2Path),
    applyNetworkSettings: (allowLanAccess: boolean) =>
      ipcRenderer.invoke("app:apply-network-settings", allowLanAccess),
  },

  overlay: {
    getState: () => ipcRenderer.invoke("overlay:get-state"),
    importZip: () => ipcRenderer.invoke("overlay:import-zip"),
    remove: (overlayId: string) => ipcRenderer.invoke("overlay:remove", overlayId),
    select: (overlayId: string) => ipcRenderer.invoke("overlay:select", overlayId),
    open: (overlayId?: string) => ipcRenderer.invoke("overlay:open", overlayId),
    reload: () => ipcRenderer.invoke("overlay:reload"),
    reveal: (overlayId: string) => ipcRenderer.invoke("overlay:reveal", overlayId),
    addDevEntry: (input: DevOverlayInput) => ipcRenderer.invoke("overlay:add-dev", input),
    getSettings: (overlayId: string) => ipcRenderer.invoke("overlay:get-settings", overlayId),
    saveSettings: (
      overlayId: string,
      payload: { settings: Record<string, unknown>; shortcutBindings: Record<string, string> },
    ) => ipcRenderer.invoke("overlay:save-settings", overlayId, payload),
    resetSettings: (overlayId: string) => ipcRenderer.invoke("overlay:reset-settings", overlayId),
    onShortcut: (callback: (event: OverlayShortcutEvent) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, payload: OverlayShortcutEvent): void =>
        callback(payload);
      ipcRenderer.on("overlay:shortcut", subscription);
      return (): void => {
        ipcRenderer.removeListener("overlay:shortcut", subscription);
      };
    },
    removeDevEntry: (overlayId: string) => ipcRenderer.invoke("overlay:remove-dev", overlayId),
    onStateChanged: (callback: (state: OverlayState) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, state: OverlayState): void =>
        callback(state);
      ipcRenderer.on("overlay:state-changed", subscription);
      return (): void => {
        ipcRenderer.removeListener("overlay:state-changed", subscription);
      };
    },
  },

  logger: {
    log: (payload: LoggerPayload) => ipcRenderer.invoke("logger:write", payload),
    read: (limit?: number) => ipcRenderer.invoke("logger:read", limit),
  },

  updater: {
    checkForUpdates: () => ipcRenderer.invoke("updater:check"),
    downloadUpdate: () => ipcRenderer.invoke("updater:download"),
    installUpdate: () => ipcRenderer.invoke("updater:install"),
    onEvent: (callback: (event: UpdaterEventPayload) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, payload: UpdaterEventPayload): void =>
        callback(payload);
      ipcRenderer.on("updater:event", subscription);
      return (): void => {
        ipcRenderer.removeListener("updater:event", subscription);
      };
    },
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    writeLog("error", "Preload", "Failed to expose Electron API", error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}

writeLog("info", "Preload", "Preload bridge ready");
