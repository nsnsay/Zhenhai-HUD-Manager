import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type { WindowAPI } from "../shared/ipc";

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
  overlayWatchStatus: (enabled: boolean) => ipcRenderer.invoke("overlay:watch-status", enabled),

  overlayDevtoolsToggle: () => ipcRenderer.invoke("overlay:toggle-devtools"),

  onOverlayLifecycle: (callback: (state: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, state: string): void =>
      callback(state);
    ipcRenderer.on("overlay:lifecycle", subscription);
    return (): void => {
      ipcRenderer.removeListener("overlay:lifecycle", subscription);
    };
  },

  db: {
    create: (collection: string, data: Record<string, any>) =>
      ipcRenderer.invoke("db:create", collection, data),
    read: (collection: string, id: string) => ipcRenderer.invoke("db:read", collection, id),
    list: (collection: string, options?: Record<string, any>) =>
      ipcRenderer.invoke("db:list", collection, options),
    update: (collection: string, id: string, data: Record<string, any>) =>
      ipcRenderer.invoke("db:update", collection, id, data),
    delete: (collection: string, id: string) => ipcRenderer.invoke("db:delete", collection, id),
  },

  file: {
    save: (base64: string, fileName: string, category: string) =>
      ipcRenderer.invoke("file:save", base64, fileName, category),
    delete: (relativePath: string) => ipcRenderer.invoke("file:delete", relativePath),
  },

  shortcut: {
    register: (accelerator: string) => ipcRenderer.invoke("shortcut:register", accelerator),
    get: () => ipcRenderer.invoke("shortcut:get"),
  },

  app: {
    getCs2Path: () => ipcRenderer.invoke("app:get-cs2-path"),
    selectDirectory: () => ipcRenderer.invoke("app:select-directory"),
    installCfg: (cs2Path: string) => ipcRenderer.invoke("app:install-cfg", cs2Path),
  },

  logger: {
    log: (payload) => ipcRenderer.invoke("logger:write", payload),
    read: (limit) => ipcRenderer.invoke("logger:read", limit),
  },

  updater: {
    checkForUpdates: () => ipcRenderer.invoke("updater:check"),
    downloadUpdate: () => ipcRenderer.invoke("updater:download"),
    installUpdate: () => ipcRenderer.invoke("updater:install"),
    onEvent: (callback) => {
      const subscription = (_event: Electron.IpcRendererEvent, payload): void => callback(payload);
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
