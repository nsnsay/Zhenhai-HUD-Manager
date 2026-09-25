/**
 * 应用设置的即时生效控制器。
 *
 * 设置面板没有 Save 按钮：每次改动都立刻写进 `extras` 集合并应用副作用
 * （语言、窗口材质、局域网监听、快捷键注册），写库做 300ms 防抖，
 * 避免拖动滑块时每帧都落盘。
 */
import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { RADAR_SETTING_DEFAULTS } from "@zhenhai/csgogsi/radar-settings";
import {
  APP_SETTINGS_CONFIG_TYPE,
  mergeAppSettings,
  type AppSettings,
  type ExtrasRecord,
  useExtrasStore,
} from "@renderer/stores/useExtrasStore";
import { rendererLogger } from "@renderer/utils/logger";
import { resolveLocale } from "@renderer/utils/locale";
import { SERVER_HOST_LOCAL, SERVER_PORT } from "../../../shared/server";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  type ShortcutAction,
  type ShortcutBindings,
} from "../../../shared/shortcuts";

/** 写库防抖：一次滑块拖动只落盘一次。 */
const PERSIST_DEBOUNCE_MS = 300;

export interface ShortcutApplyResult {
  ok: boolean;
  errors: Partial<Record<ShortcutAction, string>>;
}

export interface AppSettingsController {
  settings: Ref<AppSettings>;
  isLoading: Ref<boolean>;
  recordId: Ref<string | null>;
  /** 编辑中的 extras 文本与它的校验状态。 */
  extrasJson: Ref<string>;
  extrasInvalid: Ref<boolean>;
  networkBinding: Ref<string>;
  networkError: Ref<string | null>;
  shortcutBindings: ComputedRef<ShortcutBindings>;
  radarDefaults: typeof RADAR_SETTING_DEFAULTS;
  load: () => Promise<void>;
  setValue: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setExtrasJson: (raw: string) => void;
  applyShortcuts: (bindings: ShortcutBindings) => Promise<ShortcutApplyResult>;
  persistNow: () => Promise<void>;
}

function createAppSettings(): AppSettingsController {
  const { locale } = useI18n();
  const extrasStore = useExtrasStore();

  const settings = ref<AppSettings>(mergeAppSettings(null));
  const isLoading = ref(false);
  const recordId = ref<string | null>(null);
  const extrasJson = ref("{}");
  const extrasInvalid = ref(false);
  const networkBinding = ref(`${SERVER_HOST_LOCAL}:${SERVER_PORT}`);
  const networkError = ref<string | null>(null);

  let persistTimer: number | null = null;

  const shortcutBindings = computed<ShortcutBindings>(() => ({
    overlayRefresh: settings.value.overlayRefreshShortcut || DEFAULT_SHORTCUTS.overlayRefresh,
    overlayToggleMouseEvents:
      settings.value.overlayMouseToggleShortcut || DEFAULT_SHORTCUTS.overlayToggleMouseEvents,
  }));

  async function persistNow(): Promise<void> {
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
    }

    const payload = {
      configType: APP_SETTINGS_CONFIG_TYPE,
      settings: { ...settings.value },
    };

    const result = recordId.value
      ? await extrasStore.update(recordId.value, payload)
      : await extrasStore.create(payload);

    if (result.success) {
      if (!recordId.value && result.data?.id) {
        recordId.value = result.data.id;
      }

      return;
    }

    rendererLogger.error("AppSettings", "Failed to persist settings", result.error);
  }

  function schedulePersist(): void {
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer);
    }

    persistTimer = window.setTimeout(() => {
      void persistNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  function applyLanguage(value: AppSettings["language"]): void {
    locale.value = resolveLocale(value, navigator.language);
  }

  function applyWindowMaterial(value: AppSettings["windowMaterial"]): void {
    document.body.dataset.windowMaterial = value;
    void window.api.setWindowMaterial(value);
  }

  /**
   * 局域网开关会真的重启本地监听，所以只在应用失败时回滚并把错误显示在行内。
   */
  async function applyLanAccess(value: boolean): Promise<void> {
    networkError.value = null;

    const result = await window.api.app.applyNetworkSettings(value);

    if (result.success && result.data) {
      networkBinding.value = `${result.data.host}:${result.data.port}`;
      return;
    }

    networkError.value = result.error ?? "";
    settings.value = { ...settings.value, allowLanAccess: !value };
    schedulePersist();
  }

  const sideEffects: Record<string, (next: AppSettings) => void> = {
    language: (next) => applyLanguage(next.language),
    windowMaterial: (next) => applyWindowMaterial(next.windowMaterial),
    allowLanAccess: (next) => void applyLanAccess(next.allowLanAccess),
  };

  function setValue<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    const next = { ...settings.value, [key]: value } as AppSettings;
    settings.value = next;
    sideEffects[key as string]?.(next);
    schedulePersist();
  }

  function setExtrasJson(raw: string): void {
    extrasJson.value = raw;

    let parsed: unknown;

    try {
      parsed = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      extrasInvalid.value = true;
      return;
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      extrasInvalid.value = true;
      return;
    }

    extrasInvalid.value = false;
    settings.value = { ...settings.value, extras: parsed as Record<string, unknown> };
    schedulePersist();
  }

  async function applyShortcuts(bindings: ShortcutBindings): Promise<ShortcutApplyResult> {
    const previous = await window.api.shortcut.get();
    const registration = await window.api.shortcut.register(bindings);
    const failed = SHORTCUT_ACTIONS.filter((action) => !registration[action]?.success);

    if (failed.length > 0) {
      // 注册失败就把上一组键恢复回去，界面上不回填这组无效的组合键。
      await window.api.shortcut.register(previous);

      return {
        ok: false,
        errors: Object.fromEntries(
          failed.map((action) => [action, registration[action]?.error ?? ""]),
        ) as Partial<Record<ShortcutAction, string>>,
      };
    }

    settings.value = {
      ...settings.value,
      overlayRefreshShortcut: bindings.overlayRefresh ?? DEFAULT_SHORTCUTS.overlayRefresh,
      overlayMouseToggleShortcut:
        bindings.overlayToggleMouseEvents ?? DEFAULT_SHORTCUTS.overlayToggleMouseEvents,
    };
    schedulePersist();

    return { ok: true, errors: {} };
  }

  async function load(): Promise<void> {
    isLoading.value = true;

    try {
      await extrasStore.init();

      const record = extrasStore.items.find(
        (item) => item.configType === APP_SETTINGS_CONFIG_TYPE,
      ) as ExtrasRecord | undefined;

      recordId.value = record?.id ?? null;
      settings.value = mergeAppSettings(record?.settings);
      extrasJson.value = JSON.stringify(settings.value.extras ?? {}, null, 2);
      extrasInvalid.value = false;
      networkError.value = null;

      // 把窗口材质重新贴到 body 上：与启动时的 App.vue 保持同一份真源
      document.body.dataset.windowMaterial = settings.value.windowMaterial;

      // 让本地服务与已保存的设置对齐，并读回真实监听地址
      const network = await window.api.app.applyNetworkSettings(
        settings.value.allowLanAccess === true,
      );

      if (network.success && network.data) {
        networkBinding.value = `${network.data.host}:${network.data.port}`;
      }

      rendererLogger.info("AppSettings", "Loaded", { recordId: recordId.value });
    } catch (error) {
      rendererLogger.error("AppSettings", "Failed to load settings", error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    settings,
    isLoading,
    recordId,
    extrasJson,
    extrasInvalid,
    networkBinding,
    networkError,
    shortcutBindings,
    radarDefaults: RADAR_SETTING_DEFAULTS,
    load,
    setValue,
    setExtrasJson,
    applyShortcuts,
    persistNow,
  };
}

export const APP_SETTINGS_KEY: InjectionKey<AppSettingsController> = Symbol("app-settings");

/** 在设置面板壳组件里调用一次，把控制器提供给各个 pane。 */
export function provideAppSettings(): AppSettingsController {
  const controller = createAppSettings();
  provide(APP_SETTINGS_KEY, controller);

  return controller;
}

export function useAppSettings(): AppSettingsController {
  const controller = inject(APP_SETTINGS_KEY);

  if (!controller) {
    throw new Error("[useAppSettings] must be used inside the settings modal");
  }

  return controller;
}
