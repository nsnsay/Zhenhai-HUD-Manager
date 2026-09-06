import { ipcMain } from "electron";
import type { DatabaseService } from "../services/database.service";
import type { CollectionName, QueryOptions } from "../types/database.types";

export function registerDatabaseIpc(dbService: DatabaseService): void {
  ipcMain.handle("db:create", (_, collection: CollectionName, data: Record<string, any>) => {
    return dbService.create(collection, data);
  });

  ipcMain.handle("db:read", (_, collection: CollectionName, id: string) => {
    return dbService.read(collection, id);
  });

  ipcMain.handle("db:list", (_, collection: CollectionName, options?: QueryOptions) => {
    return dbService.list(collection, options);
  });

  ipcMain.handle(
    "db:update",
    (_, collection: CollectionName, id: string, data: Record<string, any>) => {
      return dbService.update(collection, id, data);
    },
  );

  ipcMain.handle("db:delete", (_, collection: CollectionName, id: string) => {
    return dbService.delete(collection, id);
  });
}
