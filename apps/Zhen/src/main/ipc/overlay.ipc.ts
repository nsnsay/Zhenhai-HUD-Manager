import { app, ipcMain, type BrowserWindow } from "electron";
import type { DatabaseService } from "../services/database.service";
import { overlayService } from "../services/overlay.service";
import { overlayStorage } from "../services/overlay-storage.service";
import { serverService } from "../services/server.service";
import { shortcutService, type DynamicShortcutResult } from "../services/shortcut.service";
import { logger } from "../services/logger.service";
import type { AppResult, CollectionName, DatabaseRecord } from "../../shared/ipc";
import {
  DEFAULT_OVERLAY_ID,
  isSafeOverlayId,
  nextAvailableOverlayId,
  normalizeDevUrl,
  resolveShortcutBindings,
  slugifyOverlayId,
  type DevOverlayInput,
  type OverlayEntry,
  type OverlayState,
} from "../../shared/overlays";

const APP_SETTINGS_CONFIG_TYPE = "app-settings";
const OVERLAY_COLLECTION: CollectionName = "overlays";
const OVERLAY_SHORTCUT_SCOPE = "overlay";

interface OverlayRecord extends DatabaseRecord {
  overlayId?: string;
  name?: string;
  source?: "imported" | "dev";
  entryFile?: string;
  url?: string;
  route?: string;
  version?: string;
  author?: string;
  description?: string;
  fileCount?: number;
  absoluteAssetWarning?: boolean;
  settings?: Record<string, unknown>;
  shortcutBindings?: Record<string, string>;
}

interface AppSettingsRecord extends DatabaseRecord {
  settings?: Record<string, unknown>;
}

export interface OverlayIpcOptions {
  dbService: DatabaseService;
  getMainWindow: () => BrowserWindow | null;
}

let options: OverlayIpcOptions | null = null;

function getDbService(): DatabaseService | null {
  return options?.dbService ?? null;
}

function listRecords(): OverlayRecord[] {
  const dbService = getDbService();

  if (!dbService) {
    return [];
  }

  const result = dbService.list(OVERLAY_COLLECTION);

  return result.success && Array.isArray(result.data)
    ? (result.data as unknown as OverlayRecord[])
    : [];
}

function readAppSettingsRecord(): AppSettingsRecord | null {
  const dbService = getDbService();

  if (!dbService) {
    return null;
  }

  const result = dbService.list("extras", { where: { configType: APP_SETTINGS_CONFIG_TYPE } });

  return result.success && result.data && result.data.length > 0
    ? (result.data[0] as unknown as AppSettingsRecord)
    : null;
}

function readStoredEntries(): OverlayEntry[] {
  const entries: OverlayEntry[] = [];

  for (const record of listRecords()) {
    const overlayId = typeof record.overlayId === "string" ? record.overlayId : "";

    if (!isSafeOverlayId(overlayId)) {
      continue;
    }

    if (record.source === "dev") {
      const url = typeof record.url === "string" ? record.url : "";

      if (!normalizeDevUrl(url)) {
        continue;
      }

      entries.push({
        overlayId,
        name: typeof record.name === "string" && record.name.trim() ? record.name : overlayId,
        source: "dev",
        url,
        route: typeof record.route === "string" ? record.route : undefined,
      });

      continue;
    }

    if (!overlayStorage.getUserOverlayDir(overlayId)) {
      logger.warn("OverlayIpc", `Overlay folder missing on disk, skipped: ${overlayId}`);
      continue;
    }

    entries.push({
      overlayId,
      name: typeof record.name === "string" && record.name.trim() ? record.name : overlayId,
      source: "imported",
      entryFile: typeof record.entryFile === "string" ? record.entryFile : "index.html",
      version: typeof record.version === "string" ? record.version : undefined,
      author: typeof record.author === "string" ? record.author : undefined,
      description: typeof record.description === "string" ? record.description : undefined,
      fileCount: typeof record.fileCount === "number" ? record.fileCount : undefined,
      absoluteAssetWarning: record.absoluteAssetWarning === true,
    });
  }

  return entries;
}

/** 给条目挂上磁盘清单（overlay.json → zhenhai.overlay.json）与记录里保存的用户值。 */
function withManifest(entry: OverlayEntry, record?: OverlayRecord): OverlayEntry {
  const parsed = overlayStorage.readManifestFor(entry.overlayId);

  return {
    ...entry,
    manifest: Object.keys(parsed.manifest).length > 0 ? parsed.manifest : undefined,
    settings: record?.settings && typeof record.settings === "object" ? record.settings : undefined,
    shortcutBindings:
      record?.shortcutBindings && typeof record.shortcutBindings === "object"
        ? record.shortcutBindings
        : undefined,
  };
}

function buildEntries(): OverlayEntry[] {
  const records = listRecords();

  return [
    ...overlayStorage.getBuiltinEntries().map((entry) => withManifest(entry)),
    ...readStoredEntries().map((entry) =>
      withManifest(entry, records.find((record) => record.overlayId === entry.overlayId)),
    ),
  ];
}

function readSelectedId(entries: readonly OverlayEntry[]): string {
  const stored = readAppSettingsRecord()?.settings?.selectedOverlayId;
  const candidates = entries.map((entry) => entry.overlayId);

  if (typeof stored === "string" && candidates.includes(stored)) {
    return stored;
  }

  if (candidates.includes(DEFAULT_OVERLAY_ID)) {
    return DEFAULT_OVERLAY_ID;
  }

  return candidates[0] ?? DEFAULT_OVERLAY_ID;
}

function writeSelectedId(overlayId: string): boolean {
  const dbService = getDbService();
  const record = readAppSettingsRecord();

  if (!dbService || !record) {
    return false;
  }

  const settings = record.settings ?? {};
  const result = dbService.update("extras", record.id, {
    settings: { ...settings, selectedOverlayId: overlayId },
  });

  return result.success;
}

export function buildOverlayState(): OverlayState {
  const entries = buildEntries();

  return {
    entries,
    selectedId: readSelectedId(entries),
    isDev: !app.isPackaged,
    isOpen: overlayService.isOpen(),
    ignoreMouseEvents: overlayService.isIgnoreMouseEvents(),
  };
}

export function pushOverlayState(): void {
  const mainWindow = options?.getMainWindow();

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("overlay:state-changed", buildOverlayState());
}

function findEntry(overlayId: string): OverlayEntry | null {
  return buildEntries().find((entry) => entry.overlayId === overlayId) ?? null;
}

/** 用当前选中 Overlay 声明的快捷键重建全局注册；应用自带动作优先，冲突项跳过并记录。 */
function syncOverlayShortcuts(): DynamicShortcutResult[] {
  shortcutService.unregisterAllDynamic();

  const state = buildOverlayState();
  const entry = state.entries.find((item) => item.overlayId === state.selectedId) ?? null;

  if (!entry?.manifest?.shortcuts?.length) {
    return [];
  }

  const bindings = resolveShortcutBindings(entry);

  return shortcutService.registerDynamic(OVERLAY_SHORTCUT_SCOPE, bindings, (shortcutId) => {
    const payload = { overlayId: entry.overlayId, shortcutId, timestamp: Date.now() };

    serverService.getSocketService()?.broadcast("overlay:shortcut", payload);
    overlayService.getWindow()?.webContents.send("overlay:shortcut", payload);
    logger.info("OverlayIpc", "Overlay shortcut pressed", payload);
  });
}

/**
 * 应用选中项。
 *
 * 返回「是否成功持久化」——即使写库失败也会切换当前窗口（不让用户卡住），由调用方把失败抛给界面。
 */
function applySelection(entry: OverlayEntry): boolean {
  const persisted = writeSelectedId(entry.overlayId);

  overlayService.setActiveEntry(entry);

  if (overlayService.isOpen()) {
    overlayService.reload();
  }

  syncOverlayShortcuts();
  pushOverlayState();

  return persisted;
}

function removeRecord(overlayId: string): AppResult<{ overlayId: string }> {
  const dbService = getDbService();
  const record = listRecords().find((item) => item.overlayId === overlayId);

  if (!dbService || !record) {
    return { success: false, errorCode: "overlay_not_found", error: `Overlay not found: ${overlayId}` };
  }

  const result = dbService.delete(OVERLAY_COLLECTION, record.id);

  return result.success
    ? { success: true, data: { overlayId } }
    : { success: false, errorCode: "overlay_delete_failed", error: result.error };
}

/** 启动时把选中项同步给 Overlay 窗口，并注册其声明的快捷键。 */
export function initOverlayRuntime(): void {
  overlayStorage.init();

  const entries = buildEntries();
  const selectedId = readSelectedId(entries);
  const selected = entries.find((entry) => entry.overlayId === selectedId) ?? null;

  overlayService.setActiveEntry(selected);
  syncOverlayShortcuts();

  logger.info("OverlayIpc", "Overlay runtime initialized", {
    selectedId,
    entries: entries.length,
  });
}

export function registerOverlayIpc(ipcOptions: OverlayIpcOptions): void {
  options = ipcOptions;
  initOverlayRuntime();

  ipcMain.handle("overlay:get-state", () => buildOverlayState());

  ipcMain.handle("overlay:get-settings", (_event, overlayId: unknown) => {
    if (typeof overlayId !== "string") {
      return { success: false, errorCode: "overlay_not_found", error: "Invalid overlay id." };
    }

    const entry = findEntry(overlayId);

    if (!entry) {
      return { success: false, errorCode: "overlay_not_found", error: `Overlay not found: ${overlayId}` };
    }

    const parsed = overlayStorage.readManifestFor(overlayId);
    const manifest = entry.manifest ?? parsed.manifest;

    return {
      success: true,
      data: {
        overlayId,
        manifest,
        warnings: parsed.warnings,
        settings: entry.settings ?? {},
        shortcutBindings: resolveShortcutBindings(entry),
        shortcutResults: shortcutService.getLastDynamicResults(),
        canEdit: entry.source !== "builtin",
      },
    };
  });

  ipcMain.handle("overlay:save-settings", (_event, overlayId: unknown, payload: unknown) => {
    if (typeof overlayId !== "string") {
      return { success: false, errorCode: "overlay_not_found", error: "Invalid overlay id." };
    }

    const record = listRecords().find((item) => item.overlayId === overlayId);

    if (!record) {
      return { success: false, errorCode: "manifest_invalid", error: "Only imported overlays store settings." };
    }

    const input = (payload ?? {}) as {
      settings?: Record<string, unknown>;
      shortcutBindings?: Record<string, string>;
    };

    const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
    const shortcutBindings: Record<string, string> = {};

    for (const [key, value] of Object.entries(input.shortcutBindings ?? {})) {
      if (typeof value === "string" && value.trim()) {
        shortcutBindings[key] = value.trim();
      }
    }

    const dbService = getDbService();
    const updated = dbService?.update("overlays", record.id, { settings, shortcutBindings });

    if (!updated?.success) {
      return { success: false, errorCode: "settings_write_failed", error: updated?.error ?? "Save failed." };
    }

    const shortcutResults = syncOverlayShortcuts();
    pushOverlayState();

    return { success: true, data: { shortcutResults } };
  });

  ipcMain.handle("overlay:reset-settings", (_event, overlayId: unknown) => {
    if (typeof overlayId !== "string") {
      return { success: false, errorCode: "overlay_not_found", error: "Invalid overlay id." };
    }

    const record = listRecords().find((item) => item.overlayId === overlayId);

    if (!record) {
      return { success: false, errorCode: "manifest_invalid", error: "Only imported overlays store settings." };
    }

    const dbService = getDbService();
    const updated = dbService?.update("overlays", record.id, { settings: {}, shortcutBindings: {} });

    if (!updated?.success) {
      return { success: false, errorCode: "settings_write_failed", error: updated?.error };
    }

    syncOverlayShortcuts();
    pushOverlayState();

    return { success: true, data: { overlayId } };
  });

  ipcMain.handle("overlay:import-zip", async () => {
    const imported = await overlayStorage.importFromZip();

    if (!imported.success || !imported.data) {
      return imported;
    }

    const entry = imported.data;
    const dbService = getDbService();
    const created = dbService?.create(OVERLAY_COLLECTION, { ...entry });

    if (!dbService || !created?.success) {
      overlayStorage.remove(entry.overlayId);
      return {
        success: false,
        errorCode: "zip_extract_failed",
        error: created?.error ?? "Failed to save the imported overlay.",
      };
    }

    applySelection(entry);
    logger.info("OverlayIpc", "Overlay imported", { overlayId: entry.overlayId });

    return { success: true, data: entry };
  });

  ipcMain.handle("overlay:remove", (_event, overlayId: unknown) => {
    if (typeof overlayId !== "string" || !isSafeOverlayId(overlayId)) {
      return { success: false, errorCode: "overlay_not_found", error: "Invalid overlay id." };
    }

    const entry = findEntry(overlayId);

    if (!entry || entry.source !== "imported") {
      return {
        success: false,
        errorCode: "overlay_not_found",
        error: "Only imported overlays can be removed.",
      };
    }

    const removedFiles = overlayStorage.remove(overlayId);

    if (!removedFiles.success) {
      return removedFiles;
    }

    const removedRecord = removeRecord(overlayId);

    if (!removedRecord.success) {
      return removedRecord;
    }

    if (buildOverlayState().selectedId === overlayId) {
      const fallback = findEntry(DEFAULT_OVERLAY_ID);
      overlayService.setActiveEntry(fallback);

      if (overlayService.isOpen() && fallback) {
        overlayService.reload();
      }
    }

    syncOverlayShortcuts();
    pushOverlayState();
    return { success: true, data: { overlayId } };
  });

  ipcMain.handle("overlay:select", (_event, overlayId: unknown) => {
    if (typeof overlayId !== "string") {
      return { success: false, errorCode: "overlay_not_found", error: "Invalid overlay id." };
    }

    const entry = findEntry(overlayId);

    if (!entry) {
      return { success: false, errorCode: "overlay_not_found", error: `Overlay not found: ${overlayId}` };
    }

    const persisted = applySelection(entry);

    if (!persisted) {
      return {
        success: false,
        errorCode: "settings_write_failed",
        error: "Overlay switched but the selection could not be saved.",
      };
    }

    return { success: true, data: { selectedId: entry.overlayId } };
  });

  ipcMain.handle("overlay:open", (_event, overlayId: unknown) => {
    const entry =
      typeof overlayId === "string" && overlayId ? findEntry(overlayId) : overlayService.getActiveEntry();

    if (!entry) {
      return false;
    }

    if (typeof overlayId === "string" && overlayId) {
      writeSelectedId(entry.overlayId);
    }

    const opened = overlayService.open(entry) !== null;
    pushOverlayState();

    return opened;
  });

  ipcMain.handle("overlay:reload", () => {
    const reloaded = overlayService.reload();
    pushOverlayState();

    return reloaded;
  });

  ipcMain.handle("overlay:reveal", (_event, overlayId: unknown) => {
    if (typeof overlayId !== "string") {
      return false;
    }

    return overlayStorage.reveal(overlayId);
  });

  ipcMain.handle("overlay:add-dev", (_event, input: unknown) => {
    if (app.isPackaged) {
      return {
        success: false,
        errorCode: "dev_disabled",
        error: "Development overlays are only available in unpackaged builds.",
      };
    }

    const payload = (input ?? {}) as Partial<DevOverlayInput>;
    const url = normalizeDevUrl(typeof payload.url === "string" ? payload.url : "");

    if (!url) {
      return { success: false, errorCode: "dev_url_invalid", error: "Enter a valid http(s) URL." };
    }

    const route = typeof payload.route === "string" ? payload.route.trim() : "";

    if (route && !route.startsWith("/") && !route.startsWith("#")) {
      return { success: false, errorCode: "dev_route_invalid", error: "Route must start with / or #." };
    }

    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : url;
    const overlayId = nextAvailableOverlayId(
      slugifyOverlayId(name),
      [...overlayStorage.listTakenIds(), ...listRecords().map((record) => record.overlayId ?? "")],
    );

    const entry: OverlayEntry = {
      overlayId,
      name,
      source: "dev",
      url,
      route: route || undefined,
    };

    const dbService = getDbService();
    const created = dbService?.create(OVERLAY_COLLECTION, { ...entry, source: "dev" });

    if (!dbService || !created?.success) {
      return {
        success: false,
        errorCode: "dev_url_invalid",
        error: created?.error ?? "Failed to save the development overlay.",
      };
    }

    pushOverlayState();
    logger.info("OverlayIpc", "Development overlay added", { overlayId, url, route });

    return { success: true, data: entry };
  });

  ipcMain.handle("overlay:remove-dev", (_event, overlayId: unknown) => {
    if (typeof overlayId !== "string") {
      return { success: false, errorCode: "overlay_not_found", error: "Invalid overlay id." };
    }

    const entry = findEntry(overlayId);

    if (!entry || entry.source !== "dev") {
      return {
        success: false,
        errorCode: "overlay_not_found",
        error: "Only development overlays can be removed here.",
      };
    }

    const removed = removeRecord(overlayId);

    if (!removed.success) {
      return removed;
    }

    if (buildOverlayState().selectedId === overlayId) {
      const fallback = findEntry(DEFAULT_OVERLAY_ID);
      overlayService.setActiveEntry(fallback);
    }

    syncOverlayShortcuts();
    pushOverlayState();
    return { success: true, data: { overlayId } };
  });
}