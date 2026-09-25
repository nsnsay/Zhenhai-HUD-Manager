import { defineStore } from "pinia";
import { computed } from "vue";
import { createDatabaseStore } from "./database.factory";
import type { BaseRecord } from "../types/database-store.types";
import type { QueryOptions } from "../../../shared/ipc";
import { rendererLogger } from "../utils/logger";
import {
  APP_SETTINGS_CONFIG_TYPE,
  isAppSettingsMissing,
  mergeAppSettings,
  type ExtrasRecord,
} from "./app-settings.defaults";

/**
 * 设置的纯数据部分（类型 / 默认值 / 合并规则）在 `./app-settings.defaults`，
 * 这里原样再导出，调用方仍从 `@renderer/stores/useExtrasStore` 取。
 */
export {
  APP_SETTINGS_CONFIG_TYPE,
  DEFAULT_APP_SETTINGS,
  isAppSettingsMissing,
  mergeAppSettings,
} from "./app-settings.defaults";
export type { AppSettings, ExtrasRecord } from "./app-settings.defaults";

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
