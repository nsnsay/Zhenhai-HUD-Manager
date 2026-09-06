import { defineStore } from "pinia";
import { ref, toRaw, type Ref } from "vue";
import type { BaseRecord } from "../types/database-store.types";
import type { CollectionName, QueryOptions, CrudResult } from "../types/api.types";
import { rendererLogger } from "../utils/logger";

function toPlainRecord<T>(value: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(toRaw(value))) as Record<string, unknown>;
}

export function createDatabaseStore<T extends BaseRecord = BaseRecord>(
  collectionName: CollectionName,
  storeId: string,
) {
  return defineStore(storeId, () => {
    const items = ref<T[]>([]) as Ref<T[]>;
    const isLoading = ref(false);
    const error = ref<string | null>(null);
    let initPromise: Promise<void> | null = null;

    function init(): Promise<void> {
      if (initPromise) return initPromise;

      initPromise = (async () => {
        if (isLoading.value) return;
        isLoading.value = true;
        error.value = null;

        try {
          const result = await window.api.db.list(collectionName);
          items.value = result.success && Array.isArray(result.data) ? (result.data as T[]) : [];
          rendererLogger.info("DatabaseStore", `Loaded ${collectionName}`, {
            count: items.value.length,
          });
        } catch (e) {
          rendererLogger.warn(
            "DatabaseStore",
            `Init failed for ${collectionName}, fallback to empty`,
            e,
          );
          items.value = [];
        } finally {
          isLoading.value = false;
        }
      })().finally(() => {
        initPromise = null;
      });

      return initPromise;
    }

    async function fetchList(options?: QueryOptions): Promise<void> {
      isLoading.value = true;
      error.value = null;

      try {
        const result = await window.api.db.list(collectionName, options);
        if (result.success && Array.isArray(result.data)) {
          items.value = result.data as T[];
          rendererLogger.debug("DatabaseStore", `Fetched ${collectionName}`, {
            count: items.value.length,
          });
        } else {
          error.value = result.error ?? "Failed to fetch list";
          rendererLogger.warn("DatabaseStore", `Fetch ${collectionName} failed`, result.error);
        }
      } catch (e: any) {
        error.value = e?.message ?? "IPC call failed";
        rendererLogger.error("DatabaseStore", `Fetch ${collectionName} IPC failed`, e);
      } finally {
        isLoading.value = false;
      }
    }

    async function create(data: Omit<T, keyof BaseRecord>): Promise<CrudResult<T>> {
      error.value = null;
      try {
        const result = await window.api.db.create(collectionName, toPlainRecord(data));
        if (result.success && result.data) {
          items.value.push(result.data as T);
          rendererLogger.info("DatabaseStore", `Created ${collectionName}`, {
            id: result.data.id,
          });
        } else {
          error.value = result.error ?? "Create failed";
          rendererLogger.warn("DatabaseStore", `Create ${collectionName} failed`, result.error);
        }
        return result as CrudResult<T>;
      } catch (e: any) {
        const msg: string = e?.message ?? "IPC call failed";
        error.value = msg;
        rendererLogger.error("DatabaseStore", `Create ${collectionName} IPC failed`, e);
        return { success: false, error: msg };
      }
    }

    async function update(
      id: string,
      data: Partial<Omit<T, keyof BaseRecord>>,
    ): Promise<CrudResult<T>> {
      error.value = null;
      try {
        const result = await window.api.db.update(collectionName, id, toPlainRecord(data));
        if (result.success && result.data) {
          const index = items.value.findIndex((item) => item.id === id);
          if (index !== -1) {
            items.value[index] = result.data as T;
          }
          rendererLogger.info("DatabaseStore", `Updated ${collectionName}`, { id });
        } else {
          error.value = result.error ?? "Update failed";
          rendererLogger.warn("DatabaseStore", `Update ${collectionName} failed`, {
            id,
            error: result.error,
          });
        }
        return result as CrudResult<T>;
      } catch (e: any) {
        const msg: string = e?.message ?? "IPC call failed";
        error.value = msg;
        rendererLogger.error("DatabaseStore", `Update ${collectionName} IPC failed`, e);
        return { success: false, error: msg };
      }
    }

    async function remove(id: string): Promise<CrudResult<{ id: string }>> {
      error.value = null;
      try {
        const result = await window.api.db.delete(collectionName, id);
        if (result.success) {
          items.value = items.value.filter((item) => item.id !== id);
          rendererLogger.info("DatabaseStore", `Removed ${collectionName}`, { id });
        } else {
          error.value = result.error ?? "Delete failed";
          rendererLogger.warn("DatabaseStore", `Remove ${collectionName} failed`, {
            id,
            error: result.error,
          });
        }
        return result as CrudResult<{ id: string }>;
      } catch (e: any) {
        const msg: string = e?.message ?? "IPC call failed";
        error.value = msg;
        rendererLogger.error("DatabaseStore", `Remove ${collectionName} IPC failed`, e);
        return { success: false, error: msg };
      }
    }

    function getById(id: string): T | undefined {
      return items.value.find((item) => item.id === id);
    }

    return {
      items,
      isLoading,
      error,
      init,
      fetchList,
      create,
      update,
      remove,
      getById,
    };
  });
}
