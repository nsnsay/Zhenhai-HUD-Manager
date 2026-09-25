import assert from "node:assert/strict";
import test from "node:test";

import {
  RADAR_SETTING_DEFAULTS,
  RADAR_SETTING_RANGES,
} from "@zhenhai/csgogsi/radar-settings";

import {
  DEFAULT_APP_SETTINGS,
  isAppSettingsMissing,
  mergeAppSettings,
} from "../../../renderer/src/stores/app-settings.defaults.ts";

test("雷达默认值：面板默认值与共享默认值完全一致", () => {
  for (const [key, value] of Object.entries(RADAR_SETTING_DEFAULTS)) {
    assert.deepEqual(
      DEFAULT_APP_SETTINGS[key as keyof typeof RADAR_SETTING_DEFAULTS],
      value,
      `${key} 与共享默认值不一致`,
    );
  }
});

test("雷达默认值：每一项都落在自己的可调区间内", () => {
  for (const [key, range] of Object.entries(RADAR_SETTING_RANGES)) {
    const value = RADAR_SETTING_DEFAULTS[key as keyof typeof RADAR_SETTING_RANGES];

    assert.ok(value >= range.min, `${key} 默认值 ${value} 小于下限 ${range.min}`);
    assert.ok(value <= range.max, `${key} 默认值 ${value} 大于上限 ${range.max}`);
    assert.ok(range.step > 0, `${key} 的步长必须为正`);
  }
});

test("旧设置记录缺少新字段时会被补齐", () => {
  const legacy: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS };
  delete legacy.overlayRadarSize;

  assert.equal(isAppSettingsMissing(legacy), true);

  const merged = mergeAppSettings(legacy);

  assert.equal(merged.overlayRadarSize, RADAR_SETTING_DEFAULTS.overlayRadarSize);
  assert.equal(isAppSettingsMissing(merged), false);
});
