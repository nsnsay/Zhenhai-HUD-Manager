import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { UpdaterEventPayload } from "../../../shared/ipc";
import { rendererLogger } from "@renderer/utils/logger";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

const STATUS_BY_EVENT: Record<UpdaterEventPayload["type"], UpdaterStatus> = {
  checking: "checking",
  available: "available",
  "not-available": "idle",
  downloading: "downloading",
  downloaded: "downloaded",
  error: "error",
};

function clampPercent(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * 应用更新状态。
 *
 * 主进程 UpdateService 通过 `updater:event` 推送 checking / available /
 * downloading / downloaded / error 事件；这里统一收敛成一份渲染进程状态，
 * 让 AppView 的常驻提示与设置面板的下载进度条共用同一次 IPC 订阅。
 */
export const useUpdaterStore = defineStore("updater", () => {
  const status = ref<UpdaterStatus>("idle");
  const progress = ref(0);
  const version = ref<string | null>(null);
  const errorMessage = ref<string | null>(null);

  const isChecking = computed(() => status.value === "checking");
  const isAvailable = computed(() => status.value === "available");
  const isDownloading = computed(() => status.value === "downloading");
  const isDownloaded = computed(() => status.value === "downloaded");

  let unsubscribe: (() => void) | null = null;

  function applyEvent(event: UpdaterEventPayload): void {
    // 先更新 version / progress，再更新 status，
    // 保证监听 status 的组件拿到状态变化时，附带信息已经是最新值。
    switch (event.type) {
      case "checking":
        errorMessage.value = null;
        break;
      case "available":
        version.value = event.version ?? version.value;
        progress.value = 0;
        errorMessage.value = null;
        break;
      case "not-available":
        progress.value = 0;
        break;
      case "downloading":
        progress.value = clampPercent(event.percent);
        break;
      case "downloaded":
        version.value = event.version ?? version.value;
        progress.value = 100;
        break;
      case "error":
        errorMessage.value = event.error ?? "Unknown update error";
        break;
    }

    status.value = STATUS_BY_EVENT[event.type];

    rendererLogger.debug("UpdaterStore", `Updater event: ${event.type}`, {
      version: event.version,
      percent: event.percent,
    });
  }

  /** 订阅主进程更新事件（幂等，重复调用不会重复订阅）。 */
  function init(): void {
    if (unsubscribe) {
      return;
    }

    unsubscribe = window.api.updater.onEvent(applyEvent);
    rendererLogger.info("UpdaterStore", "Updater events subscribed");
  }

  function dispose(): void {
    if (!unsubscribe) {
      return;
    }

    unsubscribe();
    unsubscribe = null;
  }

  async function checkForUpdates(): Promise<{
    success: boolean;
    updateAvailable?: boolean;
    error?: string;
  }> {
    status.value = "checking";
    errorMessage.value = null;

    const result = await window.api.updater.checkForUpdates();

    if (!result.success) {
      errorMessage.value = result.error ?? "Update check failed";
      status.value = "error";
    } else if (!result.updateAvailable) {
      status.value = "idle";
    }

    return result;
  }

  async function downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    status.value = "downloading";
    progress.value = 0;

    const result = await window.api.updater.downloadUpdate();

    if (!result.success) {
      errorMessage.value = result.error ?? "Download failed";
      status.value = "error";
    }

    return result;
  }

  function installUpdate(): Promise<boolean> {
    return window.api.updater.installUpdate();
  }

  function reset(): void {
    status.value = "idle";
    progress.value = 0;
    version.value = null;
    errorMessage.value = null;
  }

  return {
    status,
    progress,
    version,
    errorMessage,
    isChecking,
    isAvailable,
    isDownloading,
    isDownloaded,
    init,
    dispose,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    reset,
  };
});