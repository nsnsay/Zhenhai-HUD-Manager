import assert from "node:assert/strict";
import test from "node:test";

import {
  OVERLAY_ZIP_LIMITS,
  detectAbsoluteAssetRefs,
  isSafeOverlayId,
  joinOverlayRoute,
  nextAvailableOverlayId,
  composeEffectiveSettings,
  overlayPath,
  parseOverlayManifest,
  resolveOverlayUrl,
  resolveShortcutBindings,
  slugifyOverlayId,
  validateZipEntries,
  type OverlayEntry,
} from "../../../shared/overlays.ts";

const ORIGIN = "http://127.0.0.1:1469";

test("slugifyOverlayId: 文件名转为安全 id", () => {
  assert.equal(slugifyOverlayId("My Overlay v2.zip"), "my-overlay-v2");
  assert.equal(slugifyOverlayId("!!!.zip"), "overlay");
  assert.equal(isSafeOverlayId(slugifyOverlayId("A B C")), true);
});

test("nextAvailableOverlayId: 冲突时追加序号", () => {
  assert.equal(nextAvailableOverlayId("overlay", []), "overlay");
  assert.equal(nextAvailableOverlayId("overlay", ["overlay"]), "overlay-2");
  assert.equal(nextAvailableOverlayId("overlay", ["overlay", "overlay-2"]), "overlay-3");
});

test("validateZipEntries: 放行正常条目", () => {
  const result = validateZipEntries([
    { entryName: "index.html", isDirectory: false, uncompressedSize: 1024 },
    { entryName: "assets/app.js", isDirectory: false, uncompressedSize: 2048 },
  ]);

  assert.equal(result.ok, true);
});

test("validateZipEntries: 拒绝路径穿越与绝对路径", () => {
  assert.equal(
    validateZipEntries([{ entryName: "../evil.js", isDirectory: false }]).errorCode,
    "zip_unsafe_entry",
  );
  assert.equal(
    validateZipEntries([{ entryName: "/etc/passwd", isDirectory: false }]).errorCode,
    "zip_unsafe_entry",
  );
  assert.equal(
    validateZipEntries([{ entryName: "C:/windows/system32", isDirectory: false }]).errorCode,
    "zip_unsafe_entry",
  );
});

test("validateZipEntries: 拒绝符号链接与超限", () => {
  assert.equal(
    validateZipEntries([{ entryName: "link", isDirectory: false, isSymlink: true }]).errorCode,
    "zip_symlink",
  );

  const tooMany = Array.from({ length: OVERLAY_ZIP_LIMITS.maxEntries + 1 }, (_, index) => ({
    entryName: `file-${index}.js`,
    isDirectory: false,
    uncompressedSize: 1,
  }));
  assert.equal(validateZipEntries(tooMany).errorCode, "zip_too_many_entries");

  assert.equal(
    validateZipEntries([
      { entryName: "big.bin", isDirectory: false, uncompressedSize: OVERLAY_ZIP_LIMITS.maxEntryBytes + 1 },
    ]).errorCode,
    "zip_too_large",
  );
});

test("detectAbsoluteAssetRefs: 识别以 / 开头的资源引用", () => {
  assert.equal(detectAbsoluteAssetRefs('<script src="/assets/app.js"></script>'), true);
  assert.equal(detectAbsoluteAssetRefs('<link href="/style.css">'), true);
  assert.equal(detectAbsoluteAssetRefs('<script src="./assets/app.js"></script>'), false);
  assert.equal(detectAbsoluteAssetRefs('<script src="//cdn.example.com/app.js"></script>'), false);
});

test("resolveOverlayUrl: 内置/导入走本地子路径", () => {
  const builtin: OverlayEntry = { overlayId: "default", name: "Default", source: "builtin", entryFile: "index.html" };
  const imported: OverlayEntry = { overlayId: "my-hud", name: "My HUD", source: "imported", entryFile: "index.html" };

  assert.equal(resolveOverlayUrl(builtin, ORIGIN), `${ORIGIN}/overlay/`);
  assert.equal(resolveOverlayUrl(imported, ORIGIN), `${ORIGIN}/overlays/my-hud/`);
});

test("overlayPath: 三种来源的访问路径", () => {
  assert.equal(
    overlayPath({ overlayId: "default", name: "Default", source: "builtin", entryFile: "index.html" }),
    "/overlay/",
  );
  assert.equal(
    overlayPath({ overlayId: "my-hud", name: "My HUD", source: "imported", entryFile: "index.html" }),
    "/overlays/my-hud/",
  );
  assert.equal(
    overlayPath({
      overlayId: "dev",
      name: "Dev",
      source: "dev",
      url: "http://localhost:1467/overlay/",
      route: "#/x",
    }),
    "http://localhost:1467/overlay/#/x",
  );
});

test("resolveOverlayUrl: 内置默认与 overlayPath 保持一致", () => {
  const builtin: OverlayEntry = {
    overlayId: "default",
    name: "Default",
    source: "builtin",
    entryFile: "index.html",
  };

  assert.equal(resolveOverlayUrl(builtin, ORIGIN), `${ORIGIN}${overlayPath(builtin)}`);
});

test("resolveOverlayUrl: 开发条目支持 hash 与路径路由", () => {
  const hashEntry: OverlayEntry = {
    overlayId: "dev-hash",
    name: "Dev",
    source: "dev",
    url: "http://localhost:1467/overlay/",
    route: "#/debug",
  };
  const pathEntry: OverlayEntry = {
    overlayId: "dev-path",
    name: "Dev",
    source: "dev",
    url: "http://localhost:1467/overlay",
    route: "/debug",
  };

  assert.equal(resolveOverlayUrl(hashEntry, ORIGIN), "http://localhost:1467/overlay/#/debug");
  assert.equal(resolveOverlayUrl(pathEntry, ORIGIN), "http://localhost:1467/overlay/debug");
});

test("joinOverlayRoute: 无路由时补根斜杠", () => {
  assert.equal(joinOverlayRoute("http://localhost:1467/overlay/"), "http://localhost:1467/overlay/");
  assert.equal(joinOverlayRoute("http://localhost:1467/overlay", "/a//"), "http://localhost:1467/overlay/a//");
});
test("parseOverlayManifest: 读取信息 / settings / override / shortcuts", () => {
  const parsed = parseOverlayManifest({
    manifestVersion: 1,
    name: "My Overlay",
    version: "1.2.0",
    author: "me",
    settings: { somePlaceBorderRadius: 12, enabled: true },
    override: { overlayRadarMode: "mode2" },
    shortcuts: [{ id: "toggle-score", name: "Toggle score", default: "CommandOrControl+Alt+S" }],
  });

  assert.equal(parsed.warnings.length, 0);
  assert.equal(parsed.manifest.name, "My Overlay");
  assert.equal(parsed.manifest.settings?.somePlaceBorderRadius, 12);
  assert.equal(parsed.manifest.override?.overlayRadarMode, "mode2");
  assert.equal(parsed.manifest.shortcuts?.length, 1);
});

test("parseOverlayManifest: 非法内容降级为 warning", () => {
  const parsed = parseOverlayManifest({
    settings: { "bad key": 1, ok: 2 },
    shortcuts: [
      { id: "NO-UPPER", default: "CommandOrControl+X" },
      { id: "no-modifier", default: "F5" },
      { id: "dup", default: "CommandOrControl+Alt+K" },
      { id: "dup", default: "CommandOrControl+Alt+J" },
    ],
  });

  assert.equal(parsed.manifest.settings?.ok, 2);
  assert.equal(parsed.manifest.settings?.["bad key"], undefined);
  assert.equal(parsed.manifest.shortcuts?.length, 1);
  assert.ok(parsed.warnings.length >= 3);
});

test("composeEffectiveSettings: 四层优先级与 extras 键级合并", () => {
  const effective = composeEffectiveSettings(
    { overlayBorderRadius: 8, extras: { a: 1, b: 2 } },
    {
      manifest: {
        settings: { overlayBorderRadius: 4, extras: { b: 20, c: 30 } },
        override: { overlayBorderRadius: 0, extras: { d: 40 } },
      },
      settings: { overlayBorderRadius: 6, extras: { c: 99 } },
    },
  );

  assert.equal(effective?.overlayBorderRadius, 0);
  assert.deepEqual(effective?.extras, { a: 1, b: 20, c: 99, d: 40 });
});

test("composeEffectiveSettings: 没有任何来源时返回 undefined", () => {
  assert.equal(composeEffectiveSettings(null, null), undefined);
});

test("resolveShortcutBindings: 用户改键覆盖清单默认", () => {
  const bindings = resolveShortcutBindings({
    manifest: {
      shortcuts: [
        { id: "a", name: "A", default: "CommandOrControl+Alt+A" },
        { id: "b", name: "B", default: "CommandOrControl+Alt+B" },
      ],
    },
    shortcutBindings: { b: "CommandOrControl+Shift+B" },
  });

  assert.equal(bindings.a, "CommandOrControl+Alt+A");
  assert.equal(bindings.b, "CommandOrControl+Shift+B");
});