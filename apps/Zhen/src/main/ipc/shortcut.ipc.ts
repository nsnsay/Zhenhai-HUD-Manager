import { ipcMain } from "electron";
import { ShortcutService } from "../services/shortcut.service";

export function registerShortcutIpc(): void {
  ipcMain.handle("shortcut:register", (_, accelerator: string) => {
    const shortcutService = ShortcutService.getInstance();
    const success = shortcutService.register(accelerator);
    return { success, accelerator };
  });

  ipcMain.handle("shortcut:get", () => {
    const shortcutService = ShortcutService.getInstance();
    return shortcutService.getCurrent();
  });
}
