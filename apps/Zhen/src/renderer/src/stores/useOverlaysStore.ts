import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import { rendererLogger } from "@renderer/utils/logger";
import type {
  DevOverlayInput,
  OverlayEntry,
  OverlaySettingsPayload,
  OverlayState,
} from "../../../shared/ipc";

/**
 * Overlay 管理状态。
 *
 * 所有变更都通过显式 action 走到主进程，状态由主进程推送回填（单一真源）。
 */
/**
 * IPC 走结构化克隆，Vue 的响应式 Proxy 无法被克隆（DataCloneError: object could not be cloned）。
 * 与 database.factory 的 toPlainRecord 一致：先用 toRaw 去掉代理，再 JSON 往返得到纯对象。
 */
function toPlainPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(toRaw(value))) as T;
}

export const useOverlaysStore = defineStore("overlays", () => {
  const entries = ref<OverlayEntry[]>([]);
  const selectedId = ref<string>("default");
  const isDev = ref(false);
  const isOpen = ref(false);
  const ignoreMouseEvents = ref(true);

  const isLoading = ref(false);
  const isImporting = ref(false);
  const errorCode = ref<string | null>(null);

  let unsubscribe: (() => void) | null = null;

  const builtins = computed(() => entries.value.filter((entry) => entry.source === "builtin"));
  const imported = computed(() => entries.value.filter((entry) => entry.source === "imported"));
  const devEntries = computed(() => entries.value.filter((entry) => entry.source === "dev"));
  const selectedEntry = computed(
    () => entries.value.find((entry) => entry.overlayId === selectedId.value) ?? null,
  );

  function applyState(state: OverlayState): void {
    entries.value = state.entries;
    selectedId.value = state.selectedId;
    isDev.value = state.isDev;
    isOpen.value = state.isOpen;
    ignoreMouseEvents.value = state.ignoreMouseEvents;
  }

  async function refresh(): Promise<void> {
    isLoading.value = true;

    try {
      applyState(await window.api.overlay.getState());
    } catch (error) {
      rendererLogger.error("OverlaysStore", "Failed to read overlay state", error);
    } finally {
      isLoading.value = false;
    }
  }

  /** 订阅主进程推送并做一次初始同步（幂等）。 */
  async function init(): Promise<void> {
    if (!unsubscribe) {
      unsubscribe = window.api.overlay.onStateChanged(applyState);
    }

    await refresh();
  }


  function clearError(): void {
    errorCode.value = null;
  }

  async function select(overlayId: string): Promise<boolean> {
    const result = await window.api.overlay.select(overlayId);

    if (!result.success) {
      errorCode.value = result.errorCode ?? "overlay_not_found";
      return false;
    }

    errorCode.value = null;
    await refresh();
    return true;
  }

  async function openOverlay(overlayId?: string): Promise<boolean> {
    const opened = await window.api.overlay.open(overlayId);
    await refresh();
    return opened;
  }

  async function reload(): Promise<boolean> {
    return window.api.overlay.reload();
  }

  async function importZip(): Promise<OverlayEntry | null> {
    isImporting.value = true;

    try {
      const result = await window.api.overlay.importZip();

      if (!result.success || !result.data) {
        errorCode.value = result.errorCode ?? "zip_extract_failed";
        return null;
      }

      errorCode.value = null;
      await refresh();
      return result.data;
    } finally {
      isImporting.value = false;
    }
  }

  /** 读取某个 Overlay 的清单与用户值（打开设置弹窗时调用）。 */
  async function getSettings(overlayId: string): Promise<OverlaySettingsPayload | null> {
    const result = await window.api.overlay.getSettings(overlayId);

    if (!result.success || !result.data) {
      errorCode.value = result.errorCode ?? "overlay_not_found";
      return null;
    }

    errorCode.value = null;
    return result.data;
  }

  /** 保存用户值与改键；返回逐快捷键的注册结果。 */
  async function saveSettings(
    overlayId: string,
    payload: { settings: Record<string, unknown>; shortcutBindings: Record<string, string> },
  ): Promise<{ id: string; accelerator: string; success: boolean; error?: string }[] | null> {
    const result = await window.api.overlay.saveSettings(overlayId, toPlainPayload(payload));

    if (!result.success || !result.data) {
      errorCode.value = result.errorCode ?? "settings_write_failed";
      return null;
    }

    errorCode.value = null;
    await refresh();
    return result.data.shortcutResults;
  }

  async function resetSettings(overlayId: string): Promise<boolean> {
    const result = await window.api.overlay.resetSettings(overlayId);

    if (!result.success) {
      errorCode.value = result.errorCode ?? "settings_write_failed";
      return false;
    }

    errorCode.value = null;
    await refresh();
    return true;
  }

  async function remove(overlayId: string): Promise<boolean> {
    const result = await window.api.overlay.remove(overlayId);

    if (!result.success) {
      errorCode.value = result.errorCode ?? "overlay_delete_failed";
      return false;
    }

    errorCode.value = null;
    await refresh();
    return true;
  }

  async function reveal(overlayId: string): Promise<boolean> {
    return window.api.overlay.reveal(overlayId);
  }

  async function addDevEntry(input: DevOverlayInput): Promise<OverlayEntry | null> {
    const result = await window.api.overlay.addDevEntry(toPlainPayload(input));

    if (!result.success || !result.data) {
      errorCode.value = result.errorCode ?? "dev_url_invalid";
      return null;
    }

    errorCode.value = null;
    await refresh();
    return result.data;
  }

  async function removeDevEntry(overlayId: string): Promise<boolean> {
    const result = await window.api.overlay.removeDevEntry(overlayId);

    if (!result.success) {
      errorCode.value = result.errorCode ?? "overlay_not_found";
      return false;
    }

    errorCode.value = null;
    await refresh();
    return true;
  }

  return {
    entries,
    selectedId,
    isDev,
    isOpen,
    ignoreMouseEvents,
    isLoading,
    isImporting,
    errorCode,
    builtins,
    imported,
    devEntries,
    selectedEntry,
    init,
    refresh,
    clearError,
    select,
    openOverlay,
    reload,
    importZip,
    remove,
    getSettings,
    saveSettings,
    resetSettings,
    reveal,
    addDevEntry,
    removeDevEntry,
  };
});