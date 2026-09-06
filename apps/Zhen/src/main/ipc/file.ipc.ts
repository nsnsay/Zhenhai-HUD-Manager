import { ipcMain } from "electron";
import type { FileService } from "../services/file.service";

export function registerFileIpc(fileService: FileService): void {
  ipcMain.handle("file:save", (_, base64: string, fileName: string, category: string) => {
    try {
      const relativePath = fileService.save(base64, fileName, category);
      return { success: true, data: relativePath };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("file:delete", (_, relativePath: string) => {
    try {
      const deleted = fileService.delete(relativePath);
      return { success: true, data: { deleted } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
}
