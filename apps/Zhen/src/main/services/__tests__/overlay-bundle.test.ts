import assert from "node:assert/strict";
import test from "node:test";

import {
  bundleNameFromPackageName,
  buildOverlayManifest,
  overlayBundleZipName,
  parsePackArgs,
  resolveBundleConfig,
  type ResolvedBundleConfig,
} from "../../../shared/overlay-bundle.ts";

const CONFIG: ResolvedBundleConfig = {
  bundleName: "zhenhai-nagehehe",
  displayName: "ZhenHai Nagehehe Overlay",
  description: "yuwo v0.0.1-beta",
  author: "nsnsay",
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  assert.equal(result.ok, true, result.ok ? "" : result.error);

  return (result as { ok: true; value: T }).value;
}

test("parsePackArgs: 无参数时使用默认行为", () => {
  assert.deepEqual(unwrap(parsePackArgs([])), {
    forceBuild: false,
    zip: true,
    help: false,
  });
});

test("parsePackArgs: 解析全部选项", () => {
  const args = unwrap(
    parsePackArgs([
      "--project",
      "../Nagehehe",
      "--version",
      "1.0.0-beta",
      "--out",
      "out",
      "--build",
      "--no-zip",
    ]),
  );

  assert.equal(args.project, "../Nagehehe");
  assert.equal(args.version, "1.0.0-beta");
  assert.equal(args.out, "out");
  assert.equal(args.forceBuild, true);
  assert.equal(args.zip, false);
});

test("parsePackArgs: --help 与 -h 等价", () => {
  assert.equal(unwrap(parsePackArgs(["--help"])).help, true);
  assert.equal(unwrap(parsePackArgs(["-h"])).help, true);
});

test("parsePackArgs: 未知选项与缺失取值都报错", () => {
  const unknown = parsePackArgs(["--bogus"]);
  const missingValue = parsePackArgs(["--version"]);
  const flagAsValue = parsePackArgs(["--project", "--build"]);

  assert.equal(unknown.ok, false);
  assert.equal(missingValue.ok, false);
  assert.equal(flagAsValue.ok, false);
  assert.match(missingValue.ok ? "" : missingValue.error, /requires a value/);
});

test("bundleNameFromPackageName: 去 scope 并转成连字符", () => {
  assert.equal(bundleNameFromPackageName("@zhenhai/hai"), "zhenhai-hai");
  assert.equal(bundleNameFromPackageName("Nagehehe"), "zhenhai-nagehehe");
  assert.equal(bundleNameFromPackageName(""), "zhenhai-overlay");
});

test("resolveBundleConfig: 缺省 bundleName 由包名推导，author 回退 package.json", () => {
  const config = unwrap(
    resolveBundleConfig(
      { name: "@zhenhai/Nagehehe", author: "nsnsay" },
      { displayName: "ZhenHai Nagehehe Overlay" },
    ),
  );

  assert.equal(config.bundleName, "zhenhai-nagehehe");
  assert.equal(config.displayName, "ZhenHai Nagehehe Overlay");
  assert.equal(config.author, "nsnsay");
  assert.equal(config.versionFrom, undefined);
  assert.equal(config.installTo, undefined);
});

test("resolveBundleConfig: 缺 displayName 报错", () => {
  const result = resolveBundleConfig({ name: "@zhenhai/hai" }, {});

  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /displayName/);
});

test("resolveBundleConfig: 非法 bundleName / versionFrom / installTo 报错", () => {
  const badBundle = resolveBundleConfig(
    { name: "@zhenhai/hai" },
    { displayName: "X", bundleName: "ZhenHai Default" },
  );
  const badVersionFrom = resolveBundleConfig(
    { name: "@zhenhai/hai" },
    { displayName: "X", versionFrom: "../Zhen/version.json" },
  );
  const absoluteVersionFrom = resolveBundleConfig(
    { name: "@zhenhai/hai" },
    { displayName: "X", versionFrom: "E:/Zhen/package.json" },
  );
  const absoluteInstallTo = resolveBundleConfig(
    { name: "@zhenhai/hai" },
    { displayName: "X", installTo: "/tmp/overlay" },
  );

  assert.equal(badBundle.ok, false);
  assert.equal(badVersionFrom.ok, false);
  assert.equal(absoluteVersionFrom.ok, false);
  assert.equal(absoluteInstallTo.ok, false);
});

test("resolveBundleConfig: 接纳随包发布的 Overlay 配置", () => {
  const config = unwrap(
    resolveBundleConfig(
      { name: "@zhenhai/hai", author: "nsnsay" },
      {
        bundleName: "zhenhai-default",
        displayName: "ZhenHai Default Overlay",
        description: "Built-in HUD",
        versionFrom: "../Zhen/package.json",
        installTo: "../Zhen/resources/overlay",
      },
    ),
  );

  assert.equal(config.versionFrom, "../Zhen/package.json");
  assert.equal(config.installTo, "../Zhen/resources/overlay");
});

test("buildOverlayManifest: 只覆写四个生成字段并保留其余键", () => {
  const base = {
    manifestVersion: 1,
    homepage: "https://github.com/nsnsay/Zhenhai-HUD-Manager",
    settings: { overlayRadarMode: "mode1" },
    shortcuts: [{ id: "refresh", name: "Refresh", default: "Ctrl+Alt+R" }],
    name: "Stale name",
    description: "Stale description",
    version: "0.0.0",
  };

  const manifest = unwrap(buildOverlayManifest(base, CONFIG, "1.0.0-beta"));

  assert.deepEqual(manifest, {
    manifestVersion: 1,
    homepage: "https://github.com/nsnsay/Zhenhai-HUD-Manager",
    settings: { overlayRadarMode: "mode1" },
    shortcuts: [{ id: "refresh", name: "Refresh", default: "Ctrl+Alt+R" }],
    name: "ZhenHai Nagehehe Overlay",
    description: "yuwo v0.0.1-beta",
    author: "nsnsay",
    version: "1.0.0-beta",
  });
});

test("buildOverlayManifest: 缺 description/author 时删除旧值", () => {
  const manifest = unwrap(
    buildOverlayManifest(
      { name: "old", description: "old", author: "old", version: "0.0.0" },
      { bundleName: "zhenhai-default", displayName: "ZhenHai Default Overlay" },
      "2.0.12",
    ),
  );

  assert.deepEqual(manifest, {
    name: "ZhenHai Default Overlay",
    version: "2.0.12",
  });
});

test("buildOverlayManifest: 非对象清单与非法版本号报错", () => {
  const notObject = buildOverlayManifest(null, CONFIG, "1.0.0");
  const badVersion = buildOverlayManifest({}, CONFIG, "1.0.0/../x");

  assert.equal(notObject.ok, false);
  assert.equal(badVersion.ok, false);
});

test("overlayBundleZipName: 前缀 + 版本号", () => {
  assert.equal(overlayBundleZipName("zhenhai-default", "2.0.12"), "zhenhai-default-2.0.12.zip");
  assert.equal(
    overlayBundleZipName("zhenhai-nagehehe", "1.0.0-beta"),
    "zhenhai-nagehehe-1.0.0-beta.zip",
  );
});
