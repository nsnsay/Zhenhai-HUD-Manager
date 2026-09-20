import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.ico?asset";
import { registerElectronIpcService } from "./ipc/electron.ipc";
import { registerDatabaseIpc } from "./ipc/database.ipc";
import { DatabaseService } from "./services/database.service";
import { FileService } from "./services/file.service";
import { registerFileIpc } from "./ipc/file.ipc";
import { serverService } from "./services/server.service";
import { GsiService } from "./services/gsi.service";
import { GsiPipeline } from "./services/gsi-pipeline.service";
import { shortcutService } from "./services/shortcut.service";
import { registerShortcutIpc } from "./ipc/shortcut.ipc";
import createTeamEnricher from "./services/pipelines/team.pipeline";
import createPlayerEnricher from "./services/pipelines/player.pipeline";
import createMatchEnricher from "./services/pipelines/match.pipeline";
import createSettingsEnricher from "./services/pipelines/settings.pipeline";
import { registerAppIpc } from "./ipc/app.ipc";
import { registerOverlayIpc, pushOverlayState } from "./ipc/overlay.ipc";
import { logger } from "./services/logger.service";
import { registerLoggerIpc } from "./ipc/logger.ipc";
import { updateService } from "./services/update.service";
import { registerUpdateIpc } from "./ipc/update.ipc";
import { overlayService } from "./services/overlay.service";
import { DEFAULT_SHORTCUTS, type ShortcutBindings } from "../shared/shortcuts";
import type { WindowMaterial } from "../shared/ipc";

let mainWindow: BrowserWindow | null = null;

/** 从 extras 集合读到的 app-settings 子集（只取主进程关心的字段）。 */
interface StoredAppSettings {
  windowMaterial?: unknown;
  overlayRefreshShortcut?: string;
  overlayMouseToggleShortcut?: string;
  allowLanAccess?: unknown;
}

function normalizeWindowMaterial(value: unknown): WindowMaterial {
  return value === "acrylic" || value === "mica" ? value : "none";
}

function readAppSettings(dbService: DatabaseService): StoredAppSettings | null {
  const result = dbService.list("extras", { where: { configType: "app-settings" } });

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  const record = result.data[0] as { settings?: StoredAppSettings };
  return record.settings ?? null;
}

function resolveShortcutBindings(settings: StoredAppSettings | null): ShortcutBindings {
  return {
    overlayRefresh: settings?.overlayRefreshShortcut?.trim() || DEFAULT_SHORTCUTS.overlayRefresh,
    overlayToggleMouseEvents:
      settings?.overlayMouseToggleShortcut?.trim() || DEFAULT_SHORTCUTS.overlayToggleMouseEvents,
  };
}

function applyStoredWindowMaterial(settings: StoredAppSettings | null): void {
  if (process.platform !== "win32" || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const material = normalizeWindowMaterial(settings?.windowMaterial);
  mainWindow.setBackgroundMaterial(material);
  logger.info("MainWindow", `Startup background material: ${material}`);
}

function createMainWindow(): void {
  const minWidth = 1280;
  const minHeight = 750;

  mainWindow = new BrowserWindow({
    width: minWidth,
    height: minHeight,
    minWidth: minWidth,
    minHeight: minHeight,
    show: false,
    frame: false,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      devTools: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    logger.info("MainWindow", "Main window ready and shown");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    logger.info("MainWindow", "Main window closed");
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.electron");

  logger.initialize();
  registerLoggerIpc();

  createMainWindow();
  updateService.init(() => mainWindow);
  registerUpdateIpc();
  updateService.startAutoCheck();

  const dbService = DatabaseService.getInstance();
  const fileService = FileService.getInstance();
  const gsiService = GsiService.getInstance();
  const settings = readAppSettings(dbService);
  applyStoredWindowMaterial(settings);

  const gsiPipeline = new GsiPipeline();
  gsiPipeline.use(createPlayerEnricher(dbService));
  gsiPipeline.use(createTeamEnricher(dbService));
  gsiPipeline.use(createMatchEnricher(dbService));
  gsiPipeline.use(createSettingsEnricher(dbService));
  gsiService.setPipeline(gsiPipeline);

  overlayService.init({
    onLifecycle: (state) => {
      mainWindow?.webContents.send("overlay:lifecycle", state);
      pushOverlayState();
    },
    onIgnoreMouseChanged: (enabled) => {
      mainWindow?.webContents.send("overlay:ignore-mouse-changed", enabled);
      pushOverlayState();
    },
  });

  registerElectronIpcService({ getMain: () => mainWindow });
  registerDatabaseIpc(dbService);
  registerFileIpc(fileService);
  registerShortcutIpc();
  registerAppIpc();
  registerOverlayIpc({ dbService, getMainWindow: () => mainWindow });

  serverService.init(dbService, fileService, gsiService);

  shortcutService.setHandler("overlayRefresh", () => {
    serverService.getSocketService()?.broadcast("overlay:refresh", { timestamp: Date.now() });
  });
  shortcutService.setHandler("overlayToggleMouseEvents", () => {
    overlayService.toggleIgnoreMouseEvents();
  });
  shortcutService.register(resolveShortcutBindings(settings));

  const networkResult = await serverService.applyLanAccess(settings?.allowLanAccess === true);

  if (!networkResult.success) {
    logger.error("HttpServer", "Failed to start local server", networkResult.error);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  shortcutService.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});