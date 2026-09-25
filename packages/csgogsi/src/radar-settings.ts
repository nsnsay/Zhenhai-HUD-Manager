/**
 * 雷达可调参数的唯一真源。
 *
 * 管理端（设置面板）与 Overlay（读取回退）都从这里取值，避免默认值在两处漂移。
 * 长度类单位都是 1024 雷达坐标系里的像素，只有显示尺寸是屏幕像素。
 */

/** 雷达在地图上的停靠角。 */
export type RadarDock = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface RadarSettingRange {
  min: number;
  max: number;
  step: number;
}

export const RADAR_SETTING_DEFAULTS = {
  /** 雷达显示尺寸（屏幕像素）。 */
  overlayRadarSize: 420,
  overlayRadarDock: "top-left" as RadarDock,
  /** 自动放大的倍率上限。 */
  overlayRadarZoomMax: 2,
  /** 自动取景的留白（1024 坐标系单位）。 */
  overlayRadarFocusPadding: 100,
  /** 玩家标记直径（1024 坐标系单位）。 */
  overlayRadarPlayerSize: 65,
  /** 落地烟雾的覆盖直径（1024 坐标系单位）。 */
  overlayRadarSmokeSize: 65,
  /** 火焰区域轮廓的描边宽度（1024 坐标系单位）。 */
  overlayRadarFireStroke: 4,
} as const;

export const RADAR_SETTING_RANGES = {
  overlayRadarSize: { min: 200, max: 720, step: 10 },
  overlayRadarZoomMax: { min: 1, max: 3, step: 0.1 },
  overlayRadarFocusPadding: { min: 0, max: 300, step: 10 },
  overlayRadarPlayerSize: { min: 30, max: 120, step: 5 },
  overlayRadarSmokeSize: { min: 30, max: 120, step: 5 },
  overlayRadarFireStroke: { min: 0, max: 12, step: 1 },
} as const;

/** 停靠角的展示顺序（设置面板按这个顺序排单选）。 */
export const RADAR_DOCK_OPTIONS: readonly RadarDock[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

/**
 * 底图只有 1024²，放大超过这个倍率后在高 DPR 屏上会开始发软。
 * 只用于在设置面板给一行温和提示，不做实际限制。
 */
export const RADAR_ZOOM_SOFT_LIMIT = 2.4;
