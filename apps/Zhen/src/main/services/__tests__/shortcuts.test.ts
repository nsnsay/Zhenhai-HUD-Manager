import assert from "node:assert/strict";
import test from "node:test";

import {
  acceleratorFromInput,
  canonicalAccelerator,
  findDuplicateBindings,
  formatAccelerator,
} from "../../../shared/shortcuts.ts";

const baseInput = {
  code: "KeyI",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
};

test("acceleratorFromInput: Ctrl+Alt+字母", () => {
  const result = acceleratorFromInput({ ...baseInput, key: "i", ctrlKey: true, altKey: true });
  assert.equal(result, "CommandOrControl+Alt+I");
});

test("acceleratorFromInput: 必须有主修饰键（仅 Shift 或裸键返回 null）", () => {
  assert.equal(acceleratorFromInput({ ...baseInput, key: "i", shiftKey: true }), null);
  assert.equal(acceleratorFromInput({ ...baseInput, key: "i" }), null);
});

test("acceleratorFromInput: 支持功能键与空格，忽略未知键", () => {
  assert.equal(
    acceleratorFromInput({ ...baseInput, key: "F5", code: "F5", ctrlKey: true }),
    "CommandOrControl+F5",
  );
  assert.equal(
    acceleratorFromInput({ ...baseInput, key: " ", code: "Space", ctrlKey: true }),
    "CommandOrControl+Space",
  );
  assert.equal(
    acceleratorFromInput({ ...baseInput, key: ",", code: "Comma", ctrlKey: true }),
    null,
  );
});

test("formatAccelerator: 生成展示文本", () => {
  assert.equal(formatAccelerator("CommandOrControl+Alt+M"), "Ctrl + Alt + M");
  assert.equal(formatAccelerator("Super+Shift+K"), "Super + Shift + K");
  assert.equal(formatAccelerator(""), "");
});

test("findDuplicateBindings: 忽略大小写与空格差异", () => {
  const duplicated = findDuplicateBindings({
    overlayRefresh: "CommandOrControl+Alt+I",
    overlayToggleMouseEvents: "commandorcontrol + alt + i",
  });

  assert.equal(duplicated.size, 1);
  assert.deepEqual(duplicated.get(canonicalAccelerator("CommandOrControl+Alt+I")), [
    "overlayRefresh",
    "overlayToggleMouseEvents",
  ]);
});

test("findDuplicateBindings: 不重复时返回空集合", () => {
  const duplicated = findDuplicateBindings({
    overlayRefresh: "CommandOrControl+Alt+I",
    overlayToggleMouseEvents: "CommandOrControl+Alt+M",
  });

  assert.equal(duplicated.size, 0);
});