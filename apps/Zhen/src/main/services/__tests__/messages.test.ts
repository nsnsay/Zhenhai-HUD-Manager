import assert from "node:assert/strict";
import test from "node:test";

import enUS from "../../../renderer/src/locales/en-US.ts";
import zhCN from "../../../renderer/src/locales/zh-CN.ts";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function flattenMessages(value: unknown, prefix = ""): Map<string, string> {
  const messages = new Map<string, string>();

  if (value === null || typeof value !== "object") {
    messages.set(prefix, String(value));
    return messages;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    for (const [path, text] of flattenMessages(child, prefix ? `${prefix}.${key}` : key)) {
      messages.set(path, text);
    }
  }

  return messages;
}

test("i18n: zh-CN 与 en-US 的键集合完全一致", () => {
  const enKeys = flattenKeys(enUS).sort();
  const zhKeys = flattenKeys(zhCN).sort();

  assert.deepEqual(zhKeys, enKeys);
});

test("i18n: 两个语言包都没有空字符串", () => {
  for (const [path, text] of flattenMessages(enUS)) {
    assert.notEqual(text.trim(), "", `en-US.${path} is empty`);
  }

  for (const [path, text] of flattenMessages(zhCN)) {
    assert.notEqual(text.trim(), "", `zh-CN.${path} is empty`);
  }
});