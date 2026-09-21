import assert from "node:assert/strict";
import test from "node:test";

import { toHudObserverSlot } from "../pipelines/observer-slot.ts";

test("observer slot: 0..9 映射为 +1", () => {
  assert.equal(toHudObserverSlot(0), 1);
  assert.equal(toHudObserverSlot(1), 2);
  assert.equal(toHudObserverSlot(9), 10);
});

test("observer slot: 10 映射为 0", () => {
  assert.equal(toHudObserverSlot(10), 0);
});

test("observer slot: 11+ 保持原值", () => {
  assert.equal(toHudObserverSlot(11), 11);
  assert.equal(toHudObserverSlot(12), 12);
});

test("observer slot: 0..10 是双射，输出集合恰好是 0..10", () => {
  const mapped = Array.from({ length: 11 }, (_, slot) => toHudObserverSlot(slot) as number);

  assert.equal(new Set(mapped).size, 11);
  assert.deepEqual(
    [...mapped].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
});

test("observer slot: 空值返回 undefined", () => {
  assert.equal(toHudObserverSlot(undefined), undefined);
  assert.equal(toHudObserverSlot(null), undefined);
});
