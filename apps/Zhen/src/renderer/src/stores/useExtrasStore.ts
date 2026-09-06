import { defineStore } from "pinia";
import { computed } from "vue";
import { createDatabaseStore } from "./database.factory";
import type { BaseRecord } from "../types/database-store.types";
import type { SettingFormData } from "@zhenhai/csgogsi/types";
import type { QueryOptions } from "../../../shared/ipc";
import { rendererLogger } from "../utils/logger";

export interface AppSettings extends SettingFormData {
  firstStartFinished: boolean;
  cs2Path: string;
}

export interface ExtrasRecord extends BaseRecord {
  configType?: string;
  settings?: AppSettings;
}

export const APP_SETTINGS_CONFIG_TYPE = "app-settings";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ctDefaultColor: "hsl(213.428584, 100%, 50%)",
  tDefaultColor: "hsl(44.14287, 100%, 43.75%)",
  primaryDefaultColor: "hsl(0, 0%, 0%)",
  secondaryDefaultColor: "hsl(0, 0%, 100%)",
  overlayPlayerSidebarMode: "mode1",
  overlayPlayerFocusedMode: "mode1",
  overlayMatchBarMode: "mode1",
  overlayMatchInfoMode: "mode1",
  overlayRadarMode: "mode1",
  overlayKillfeedMode: "mode1",
  overlayBorderRadius: 8,
  overlayRefreshShortcut: "CommandOrControl+Alt+I",
  overlaySafeZoneX: 16,
  overlaySafeZoneY: 16,
  extras: {},
  windowMaterial: "none",
  firstStartFinished: false,
  cs2Path: "",
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 合并默认设置和当前设置。
 * 当前设置优先，所以不会覆盖已经存在的值。
 */
export function mergeAppSettings(current?: Partial<AppSettings> | null): AppSettings {
  const safeCurrent = current && typeof current === "object" ? current : {};

  return {
    ...DEFAULT_APP_SETTINGS,
    ...safeCurrent,
    extras: {
      ...toRecord(DEFAULT_APP_SETTINGS.extras),
      ...toRecord(safeCurrent.extras),
    },
  } as AppSettings;
}

/**
 * 判断当前 settings 是否缺少默认字段。
 */
export function isAppSettingsMissing(current?: Partial<AppSettings> | null): boolean {
  if (!current || typeof current !== "object") {
    return true;
  }

  const record = current as Partial<AppSettings>;

  return Object.keys(DEFAULT_APP_SETTINGS).some((key) => record[key] === undefined);
}

/**
 * 内部基础 Store，仍然使用原来的 database factory。
 * 注意这里 storeId 用 db-extras-base，避免和外层包装 Store 冲突。
 */
const useBaseExtrasStore = createDatabaseStore<ExtrasRecord>("extras", "db-extras-base");

export const useExtrasStore = defineStore("db-extras", () => {
  const base = useBaseExtrasStore();

  let pendingInit: Promise<void> | null = null;

  const items = computed(() => base.items);
  const isLoading = computed(() => base.isLoading);
  const error = computed(() => base.error);

  /**
   * 确保 app-settings 存在，并且字段完整。
   */
  async function ensureDefaultAppSettings(): Promise<void> {
    const listResult = await window.api.db.list("extras", {
      where: {
        configType: APP_SETTINGS_CONFIG_TYPE,
      },
    });

    if (!listResult.success || !Array.isArray(listResult.data)) {
      return;
    }

    const records = listResult.data;
    const record = records[0] as ExtrasRecord | undefined;

    // 情况一：完全没有 app-settings，自动插入默认设置
    if (!record) {
      const createResult = await base.create({
        configType: APP_SETTINGS_CONFIG_TYPE,
        settings: mergeAppSettings(null),
      });

      if (createResult.success) {
        await base.fetchList();
        rendererLogger.info("ExtrasStore", "Default app settings created");
      }

      return;
    }

    // 情况二：已有 app-settings，但字段部分缺失，自动补齐
    if (isAppSettingsMissing(record.settings)) {
      const mergedSettings = mergeAppSettings(record.settings);

      const updateResult = await base.update(record.id, {
        settings: mergedSettings,
      });

      if (updateResult.success) {
        await base.fetchList();
        rendererLogger.info("ExtrasStore", "App settings defaults merged", {
          recordId: record.id,
        });
      }
    }
  }

  /**
   * 初始化 extras。
   * 同时执行默认设置补全。
   */
  function init(): Promise<void> {
    if (pendingInit) {
      return pendingInit;
    }

    pendingInit = (async () => {
      await base.init();
      await ensureDefaultAppSettings();
    })().finally(() => {
      pendingInit = null;
    });

    return pendingInit;
  }

  return {
    items,
    isLoading,
    error,
    init,
    ensureDefaultAppSettings,

    fetchList: (options?: QueryOptions) => base.fetchList(options),
    create: (data: Omit<ExtrasRecord, keyof BaseRecord>) => base.create(data),
    update: (id: string, data: Partial<Omit<ExtrasRecord, keyof BaseRecord>>) =>
      base.update(id, data),
    remove: (id: string) => base.remove(id),
    getById: (id: string) => base.getById(id),
  };
});
