import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocale } from "../../../renderer/src/utils/locale.ts";

test("resolveLocale: 显式偏好优先", () => {
  assert.equal(resolveLocale("zh-CN", "en-US"), "zh-CN");
  assert.equal(resolveLocale("en-US", "zh-CN"), "en-US");
});

test("resolveLocale: system 跟随系统语言", () => {
  assert.equal(resolveLocale("system", "zh-CN"), "zh-CN");
  assert.equal(resolveLocale("system", "zh-Hans-CN"), "zh-CN");
  assert.equal(resolveLocale("system", "en-GB"), "en-US");
  assert.equal(resolveLocale("system", "de-DE"), "en-US");
});

test("resolveLocale: 缺失或非法偏好回退系统判断", () => {
  assert.equal(resolveLocale(undefined, "zh-TW"), "zh-CN");
  assert.equal(resolveLocale(null, "fr-FR"), "en-US");
});