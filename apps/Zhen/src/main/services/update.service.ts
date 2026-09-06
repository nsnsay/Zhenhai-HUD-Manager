import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import type { UpdaterEventPayload } from "../../shared/ipc";
import { logger } from "./logger.service";

type WindowProvider = () => BrowserWindow | null;

class UpdateService {
  private static instance: UpdateService;
  private initialized = false;
  private getMainWindow: WindowProvider | null = null;

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  init(getMainWindow: WindowProvider): void {
    if (this.initialized) return;
    this.initialized = true;
    this.getMainWindow = getMainWindow;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.forceDevUpdateConfig = !app.isPackaged;
    autoUpdater.logger = {
      info: (message) => logger.info("UpdateService", String(message)),
      warn: (message) => logger.warn("UpdateService", String(message)),
      error: (message) => logger.error("UpdateService", String(message)),
      debug: (message) => logger.debug("UpdateService", String(message)),
    };

    autoUpdater.on("checking-for-update", () => {
      logger.info("UpdateService", "Checking for updates");
      this.emit("checking");
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      logger.info("UpdateService", "Update available", { version: info.version });
      this.emit("available", { version: info.version });
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      logger.info("UpdateService", "No update available", { version: info.version });
      this.emit("not-available", { version: info.version });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      logger.debug("UpdateService", "Download progress", { percent: progress.percent });
      this.emit("downloading", { percent: Math.round(progress.percent) });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      logger.info("UpdateService", "Update downloaded", { version: info.version });
      this.emit("downloaded", { version: info.version });
    });

    autoUpdater.on("error", (error: Error) => {
      logger.error("UpdateService", "Update check failed", error);
      this.emit("error", { error: error.message });
    });

    logger.info("UpdateService", "Initialized");
  }

  async checkForUpdates(): Promise<{
    success: boolean;
    updateAvailable?: boolean;
    error?: string;
  }> {
    try {
      logger.info("UpdateService", "Manual/automatic update check requested");
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        updateAvailable: Boolean(result?.isUpdateAvailable),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("UpdateService", "Update check failed", error);
      this.emit("error", { error: message });
      return { success: false, error: message };
    }
  }

  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info("UpdateService", "Download requested");
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("UpdateService", "Download failed", error);
      return { success: false, error: message };
    }
  }

  installUpdate(): boolean {
    try {
      logger.info("UpdateService", "Install and restart requested");
      autoUpdater.quitAndInstall(false, true);
      return true;
    } catch (error) {
      logger.error("UpdateService", "Install failed", error);
      return false;
    }
  }

  startAutoCheck(delayMs = 8000): void {
    setTimeout(() => {
      void this.checkForUpdates();
    }, delayMs);
  }

  private emit(type: UpdaterEventPayload["type"], extra?: Partial<UpdaterEventPayload>): void {
    const window = this.getMainWindow?.();
    if (!window || window.isDestroyed()) return;
    window.webContents.send("updater:event", {
      type,
      ...extra,
    } satisfies UpdaterEventPayload);
  }
}

export const updateService = UpdateService.getInstance();
