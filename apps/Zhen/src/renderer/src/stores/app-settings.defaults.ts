/**
 * 应用设置的纯数据部分：类型、默认值与合并规则。
 *
 * 单独拆出来是为了能在 `node --test` 下直接单测 —— 这里不碰 window、Pinia 与 Electron。
 * 雷达相关的默认值来自 `@zhenhai/csgogsi/radar-settings`，与 Overlay 侧的回退值同源。
 */
import type { SettingFormData } from "@zhenhai/csgogsi/types";
import { RADAR_SETTING_DEFAULTS } from "@zhenhai/csgogsi/radar-settings";
// 带扩展名：这个模块要被 `node --test` 直接加载，Node 的 ESM 解析要求显式后缀。
import { DEFAULT_SHORTCUTS } from "../../../shared/shortcuts";
import type { BaseRecord } from "../types/database-store.types";

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
  overlayRadarAutoZoom: true,
  overlayRadarSize: RADAR_SETTING_DEFAULTS.overlayRadarSize,
  overlayRadarDock: RADAR_SETTING_DEFAULTS.overlayRadarDock,
  overlayRadarZoomMax: RADAR_SETTING_DEFAULTS.overlayRadarZoomMax,
  overlayRadarFocusPadding: RADAR_SETTING_DEFAULTS.overlayRadarFocusPadding,
  overlayRadarPlayerSize: RADAR_SETTING_DEFAULTS.overlayRadarPlayerSize,
  overlayRadarSmokeSize: RADAR_SETTING_DEFAULTS.overlayRadarSmokeSize,
  overlayRadarFireStroke: RADAR_SETTING_DEFAULTS.overlayRadarFireStroke,
  overlayKillfeedMode: "mode1",
  overlayBorderRadius: 8,
  overlayRefreshShortcut: DEFAULT_SHORTCUTS.overlayRefresh,
  overlayMouseToggleShortcut: DEFAULT_SHORTCUTS.overlayToggleMouseEvents,
  overlaySafeZoneX: 16,
  overlaySafeZoneY: 16,
  extras: {},
  windowMaterial: "none",
  firstStartFinished: false,
  cs2Path: "",
  allowLanAccess: false,
  language: "system",
  selectedOverlayId: "default",
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

  // 这里只判断「键是否存在」，用索引签名取值即可。
  const record = current as Record<string, unknown>;

  return Object.keys(DEFAULT_APP_SETTINGS).some((key) => record[key] === undefined);
}
