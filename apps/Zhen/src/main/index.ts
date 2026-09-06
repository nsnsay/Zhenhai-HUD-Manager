import { app, shell, BrowserWindow } from "electron";
import { join } from "path";
import { electronApp, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.ico?asset";
import { registerElectronIpcService } from "./ipc/electron.ipc";
import { registerDatabaseIpc } from "./ipc/database.ipc";
import { DatabaseService } from "./services/database.service";
import { startExpressServer } from "./services/express.service";
import { FileService } from "./services/file.service";
import { registerFileIpc } from "./ipc/file.ipc";
import { SocketService } from "./services/socket.service";
import { GsiService } from "./services/gsi.service";
import { GsiPipeline } from "./services/gsi-pipeline.service";
import { ShortcutService } from "./services/shortcut.service";
import { registerShortcutIpc } from "./ipc/shortcut.ipc";
import createTeamEnricher from "./services/pipelines/team.pipeline";
import createPlayerEnricher from "./services/pipelines/player.pipeline";
import createMatchEnricher from "./services/pipelines/match.pipeline";
import createSettingsEnricher from "./services/pipelines/settings.pipeline";
import { registerAppIpc } from "./ipc/app.ipc";
import { logger } from "./services/logger.service";
import { registerLoggerIpc } from "./ipc/logger.ipc";
import { updateService } from "./services/update.service";
import { registerUpdateIpc } from "./ipc/update.ipc";
import type { WindowMaterial } from "../shared/ipc";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

const SERVER_PORT = 1469;
const OVERLAY_PUBLIC_URL = `http://127.0.0.1:${SERVER_PORT}/overlay/`;
const OVERLAY_DEV_URL = "http://localhost:1467/overlay/";

function normalizeWindowMaterial(value: unknown): WindowMaterial {
  return value === "acrylic" || value === "mica" ? value : "none";
}

function applyStoredWindowMaterial(dbService: DatabaseService): void {
  if (process.platform !== "win32" || !mainWindow || mainWindow.isDestroyed()) return;

  const settingsResult = dbService.list("extras", {
    where: { configType: "app-settings" },
  });
  const record = settingsResult.success
    ? (settingsResult.data?.[0] as { settings?: { windowMaterial?: unknown } } | undefined)
    : undefined;
  const material = normalizeWindowMaterial(record?.settings?.windowMaterial);

  mainWindow.setBackgroundMaterial(material);
  logger.info("MainWindow", `Startup background material: ${material}`);
}

function createMainWindow(): void {
  let minWidth = 1280;
  let minHeight = 750;
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

function createOverlayWindow(): void {
  overlayWindow = new BrowserWindow({
    fullscreen: true,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    focusable: true,
    frame: false,
    title: "Zhenhai Overlay",
    icon: icon,
    skipTaskbar: true,
    type: "toolbar",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true,
    },
  });

  overlayWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    logger.info("OverlayWindow", "Overlay window destroyed, reference cleared");
  });

  logger.info("OverlayWindow", "Overlay window created");

  overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
  overlayWindow.setFullScreen(true);
  overlayWindow.setIgnoreMouseEvents(true);

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    overlayWindow.loadURL(OVERLAY_DEV_URL);
  } else {
    overlayWindow.loadURL(OVERLAY_PUBLIC_URL);
  }
}

app.whenReady().then(() => {
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
  applyStoredWindowMaterial(dbService);

  const gsiPipeline = new GsiPipeline();
  gsiPipeline.use(createPlayerEnricher(dbService));
  gsiPipeline.use(createTeamEnricher(dbService));
  gsiPipeline.use(createMatchEnricher(dbService));
  gsiPipeline.use(createSettingsEnricher(dbService));
  gsiService.setPipeline(gsiPipeline);

  registerElectronIpcService({
    getMain: () => mainWindow,
    getOverlay: () => overlayWindow,
    createOverlay: () => {
      createOverlayWindow();
      return overlayWindow;
    },
  });

  registerDatabaseIpc(dbService);
  registerFileIpc(fileService);
  registerShortcutIpc();
  registerAppIpc();

  const server = startExpressServer(dbService, fileService);
  const socketService = SocketService.init(server);
  socketService.bindGsi(gsiService);

  const shortcutService = ShortcutService.getInstance();
  shortcutService.setSocketService(socketService);

  let shortcut = "CommandOrControl+Alt+I";
  const settingsResult = dbService.list("extras", { where: { configType: "app-settings" } });
  if (settingsResult.success && settingsResult.data && settingsResult.data.length > 0) {
    const settings = (settingsResult.data[0] as { settings?: { overlayRefreshShortcut?: string } })
      .settings;
    if (settings?.overlayRefreshShortcut) {
      shortcut = settings.overlayRefreshShortcut;
    }
  }
  shortcutService.register(shortcut);

  server.listen(SERVER_PORT, "0.0.0.0", () => {
    logger.info("HttpServer", `Express + Socket.IO running at http://0.0.0.0:${SERVER_PORT}`);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => {
  ShortcutService.getInstance().unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
