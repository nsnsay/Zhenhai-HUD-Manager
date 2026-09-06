import { ipcMain, BrowserWindow, app, nativeTheme } from "electron";
import { logger } from "../services/logger.service";
import type { NativeThemeSource, WindowMaterial } from "../../shared/ipc";

const WINDOW_MATERIALS = new Set<WindowMaterial>(["none", "acrylic", "mica"]);

function normalizeWindowMaterial(value: unknown): WindowMaterial {
  return WINDOW_MATERIALS.has(value as WindowMaterial) ? (value as WindowMaterial) : "none";
}

function normalizeThemeSource(value: unknown): NativeThemeSource {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

interface WindowRefs {
  getMain: () => BrowserWindow | null;
  getOverlay: () => BrowserWindow | null;
  createOverlay: () => BrowserWindow | null;
}

export function registerElectronIpcService(refs: WindowRefs): void {
  ipcMain.handle("main-window:minimize", () => refs.getMain()?.minimize());

  ipcMain.handle("main-window:maximize", () => {
    const win = refs.getMain();
    if (win && !win.isDestroyed()) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.handle("main-window:close", () => {
    app.quit();
  });

  ipcMain.handle("main-window:toggle-devtools", () => {
    const win = refs.getMain();
    if (!win || win.isDestroyed()) return false;
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools({ mode: "detach" });
    }
    return true;
  });

  ipcMain.handle("main-window:set-background-material", (_event, material: WindowMaterial) => {
    const win = refs.getMain();
    if (!win || win.isDestroyed()) return false;

    const normalized = normalizeWindowMaterial(material);
    logger.info("MainWindow", `Set background material to ${normalized}`);

    if (process.platform === "win32") {
      win.setBackgroundMaterial(normalized);
      return true;
    }

    return false;
  });

  ipcMain.handle("main-window:set-theme-source", (_event, theme: NativeThemeSource) => {
    const normalized = normalizeThemeSource(theme);
    nativeTheme.themeSource = normalized;
    logger.info("MainWindow", `Native theme source set to ${normalized}`);
    return true;
  });

  ipcMain.handle("overlay:create", () => {
    logger.info("OverlayWindow", "IPC overlay:create");
    let win = refs.getOverlay();
    if (!win || win.isDestroyed()) {
      win = refs.createOverlay();
      if (win) {
        bindOverlayLifecycle(refs);
      }
    }
    if (win && !win.isDestroyed()) {
      win.show();
      return true;
    }
    return false;
  });

  ipcMain.handle("overlay:close", () => {
    logger.info("OverlayWindow", "IPC overlay:close");
    const win = refs.getOverlay();
    if (win && !win.isDestroyed()) {
      win.close();
    }
    return true;
  });

  ipcMain.handle("overlay:toggle-devtools", () => {
    const win = refs.getOverlay();
    if (!win || win.isDestroyed()) return false;
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools({ mode: "detach" });
    }
    return true;
  });

  ipcMain.handle("overlay:watch-status", (_e, enabled: boolean) => {
    const win = refs.getOverlay();
    if (!win || win.isDestroyed()) return false;
    win.webContents.send("overlay:status-update", { active: enabled });
    return true;
  });
}

function bindOverlayLifecycle(refs: WindowRefs): void {
  const win = refs.getOverlay();
  if (!win || win.isDestroyed()) return;
  if ((win as any).__lifecycleBound) return;
  (win as any).__lifecycleBound = true;

  const notifyMain = (event: string, data?: unknown) => {
    logger.info("OverlayWindow", `Overlay lifecycle event: ${event}`, data);
    const main = refs.getMain();
    if (main && !main.isDestroyed()) {
      main.webContents.send(event, data);
    }
  };

  win.on("show", () => notifyMain("overlay:lifecycle", "shown"));
  win.on("hide", () => notifyMain("overlay:lifecycle", "hidden"));
  win.on("close", () => notifyMain("overlay:lifecycle", "closing"));
  win.on("closed", () => notifyMain("overlay:lifecycle", "closed"));
}
