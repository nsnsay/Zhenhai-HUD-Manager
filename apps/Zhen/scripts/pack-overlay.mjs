/**
 * 把构建好的 Overlay（apps/Zhen/resources/overlay）压成可再分发的 zip。
 *
 * - 生成前把 apps/Zhen/package.json 的版本号写入产物里的 overlay.json（单一版本来源）；
 * - 输出到 resources/overlay-bundles/zhenhai-default-<version>.zip，由 electron-builder 作为
 *   extraResources 打进安装包，用户也能直接用「导入 Overlay (.zip)」重新导入。
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const overlayDir = join(appRoot, "resources", "overlay");
const bundlesDir = join(appRoot, "resources", "overlay-bundles");
const bundlePrefix = "zhenhai-default";

if (!existsSync(join(overlayDir, "index.html"))) {
  console.error("[pack-overlay] resources/overlay/index.html not found — build apps/Hai first.");
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
const manifestPath = join(overlayDir, "overlay.json");

if (!existsSync(manifestPath)) {
  console.error("[pack-overlay] overlay.json missing in the built overlay — build apps/Hai first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

mkdirSync(bundlesDir, { recursive: true });

for (const name of readdirSync(bundlesDir)) {
  if (name.startsWith(`${bundlePrefix}-`) && name.endsWith(".zip")) {
    rmSync(join(bundlesDir, name), { force: true });
  }
}

const zip = new AdmZip();
zip.addLocalFolder(overlayDir);

const target = join(bundlesDir, `${bundlePrefix}-${version}.zip`);
zip.writeZip(target);

console.log(`[pack-overlay] ${relative(appRoot, target)} (${statSync(target).size} bytes)`);