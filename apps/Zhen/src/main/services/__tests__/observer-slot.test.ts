import assert from "node:assert/strict";
import test from "node:test";

import { toHudObserverSlot } from "../pipelines/observer-slot.ts";

test("observer slot: 1..9 映射为 +1", () => {
  assert.equal(toHudObserverSlot(1), 2);
  assert.equal(toHudObserverSlot(9), 10);
});

test("observer slot: 10 映射为 0", () => {
  assert.equal(toHudObserverSlot(10), 0);
});

test("observer slot: 0 与 11+ 保持原值", () => {
  assert.equal(toHudObserverSlot(0), 0);
  assert.equal(toHudObserverSlot(11), 11);
});

test("observer slot: 空值返回 undefined", () => {
  assert.equal(toHudObserverSlot(undefined), undefined);
  assert.equal(toHudObserverSlot(null), undefined);
});