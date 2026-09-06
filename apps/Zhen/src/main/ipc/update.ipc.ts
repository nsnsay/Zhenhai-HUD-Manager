import { ipcMain } from "electron";
import { updateService } from "../services/update.service";

export function registerUpdateIpc(): void {
  ipcMain.handle("updater:check", () => updateService.checkForUpdates());
  ipcMain.handle("updater:download", () => updateService.downloadUpdate());
  ipcMain.handle("updater:install", () => updateService.installUpdate());
}
