import { ipcMain, BrowserWindow, app, nativeTheme } from "electron";
import { logger } from "../services/logger.service";
import { overlayService } from "../services/overlay.service";
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

  // Overlay 相关操作统一委托给 OverlayService（窗口生命周期与鼠标穿透状态都在那里）。
  ipcMain.handle("overlay:create", () => overlayService.open() !== null);

  ipcMain.handle("overlay:close", () => {
    overlayService.close();
    return true;
  });

  ipcMain.handle("overlay:toggle-devtools", () => overlayService.toggleDevTools());

  ipcMain.handle("overlay:get-ignore-mouse-events", () => overlayService.isIgnoreMouseEvents());
}