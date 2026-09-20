import { ipcMain } from "electron";
import type { ShortcutBindings } from "../../shared/ipc";
import { shortcutService } from "../services/shortcut.service";

export function registerShortcutIpc(): void {
  ipcMain.handle("shortcut:register", (_, bindings: ShortcutBindings) => {
    return shortcutService.register(bindings ?? {});
  });

  ipcMain.handle("shortcut:get", () => {
    return shortcutService.getRegistered();
  });
}