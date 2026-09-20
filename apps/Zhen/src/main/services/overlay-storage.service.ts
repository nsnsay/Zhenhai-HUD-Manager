import { app, dialog, shell } from "electron";
import { basename, join } from "path";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";
import { errorMessage } from "../../shared/errors";
import type { AppResult } from "../../shared/ipc";
import {
  DEFAULT_OVERLAY_ID,
  OVERLAY_ENTRY_FILE,
  OVERLAY_MANIFEST_FILES,
  OVERLAY_MANIFEST_FILE,
  parseOverlayManifest,
  type ParsedOverlayManifest,
  detectAbsoluteAssetRefs,
  isSafeOverlayId,
  nextAvailableOverlayId,
  slugifyOverlayId,
  validateZipEntries,
  type OverlayEntry,
  type OverlayErrorCode,
  type ZipEntryLike,
} from "../../shared/overlays";
import { logger } from "./logger.service";

interface OverlayManifest {
  name?: string;
  version?: string;
  author?: string;
  description?: string;
}

function failure(errorCode: OverlayErrorCode, error: string): AppResult<OverlayEntry> {
  return { success: false, errorCode, error };
}

function isSymlinkEntry(entry: AdmZip.IZipEntry): boolean {
  if (!entry.isDirectory) {
    const unixMode = (entry.attr >>> 16) & 0xf000;
    return unixMode === 0xa000;
  }

  return false;
}

/**
 * Overlay 磁盘存储：内置目录发现 + 第三方 zip 导入 / 删除 / 定位。
 *
 * 目录约定：
 * - 内置默认：resources/overlay（等价 overlayId = "default"）
 * - 额外内置：resources/overlays/<id>/index.html
 * - 用户导入：<Documents>/ZhenHai/overlays/<id>/
 */
class OverlayStorageService {
  private static instance: OverlayStorageService;

  private userOverlaysDir = "";
  private builtinRoots = new Map<string, string>();

  static getInstance(): OverlayStorageService {
    if (!OverlayStorageService.instance) {
      OverlayStorageService.instance = new OverlayStorageService();
    }

    return OverlayStorageService.instance;
  }

  init(): void {
    this.userOverlaysDir = join(app.getPath("documents"), "ZhenHai", "overlays");
    mkdirSync(this.userOverlaysDir, { recursive: true });

    this.builtinRoots = this.discoverBuiltins();

    logger.info("OverlayStorage", "Initialized", {
      userOverlaysDir: this.userOverlaysDir,
      builtins: [...this.builtinRoots.keys()],
    });
  }

  getUserOverlaysDir(): string {
    return this.userOverlaysDir;
  }

  getBuiltinEntries(): OverlayEntry[] {
    return [...this.builtinRoots.keys()].map((overlayId) => ({
      overlayId,
      name: overlayId === DEFAULT_OVERLAY_ID ? "ZhenHai Default" : overlayId,
      source: "builtin" as const,
      entryFile: OVERLAY_ENTRY_FILE,
      fileCount: 0,
    }));
  }

  listTakenIds(): string[] {
    const ids = new Set<string>(this.builtinRoots.keys());

    if (existsSync(this.userOverlaysDir)) {
      for (const name of readdirSync(this.userOverlaysDir)) {
        ids.add(name);
      }
    }

    return [...ids];
  }

  /** 供 Express 解析静态根目录；未知或非法 id 返回 null。 */
  resolveStaticRoot(overlayId: string): string | null {
    if (!isSafeOverlayId(overlayId)) {
      return null;
    }

    const builtinRoot = this.builtinRoots.get(overlayId);

    if (builtinRoot) {
      return builtinRoot;
    }

    const userRoot = join(this.userOverlaysDir, overlayId);

    return existsSync(userRoot) ? userRoot : null;
  }

  getUserOverlayDir(overlayId: string): string | null {
    if (!isSafeOverlayId(overlayId)) {
      return null;
    }

    const dir = join(this.userOverlaysDir, overlayId);

    return existsSync(dir) ? dir : null;
  }

  getEntryFile(overlayId: string): string | null {
    const root = this.resolveStaticRoot(overlayId);

    if (!root) {
      return null;
    }

    const entry = join(root, OVERLAY_ENTRY_FILE);

    return existsSync(entry) ? entry : null;
  }

  async importFromZip(): Promise<AppResult<OverlayEntry>> {
    const selection = await dialog.showOpenDialog({
      title: "Import overlay bundle",
      properties: ["openFile"],
      filters: [{ name: "Overlay bundle", extensions: ["zip"] }],
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return { success: false, errorCode: "zip_unreadable", error: "Import canceled." };
    }

    return this.installFromZip(selection.filePaths[0]!);
  }

  async installFromZip(zipPath: string): Promise<AppResult<OverlayEntry>> {
    const tempDir = join(app.getPath("temp"), `zhenhai-overlay-${randomUUID()}`);

    try {
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      const zipEntries: ZipEntryLike[] = entries.map((entry) => ({
        entryName: entry.entryName,
        isDirectory: entry.isDirectory,
        uncompressedSize: entry.header.size,
        isSymlink: isSymlinkEntry(entry),
      }));

      const validation = validateZipEntries(zipEntries);

      if (!validation.ok) {
        return failure(
          validation.errorCode ?? "zip_unreadable",
          validation.error ?? "Zip validation failed.",
        );
      }

      mkdirSync(tempDir, { recursive: true });
      zip.extractAllTo(tempDir, true);

      const root = this.findOverlayRoot(tempDir);

      if (!root) {
        return failure(
          "zip_no_index_html",
          `Zip must contain ${OVERLAY_ENTRY_FILE} (at its root or inside a single top-level folder).`,
        );
      }

      const manifest = this.readManifest(root);
      const displayName = manifest?.name?.trim() || basename(zipPath).replace(/\.zip$/i, "");
      const overlayId = nextAvailableOverlayId(
        slugifyOverlayId(manifest?.name?.trim() || basename(zipPath)),
        this.listTakenIds(),
      );

      const destination = join(this.userOverlaysDir, overlayId);

      try {
        renameSync(root, destination);
      } catch {
        cpSync(root, destination, { recursive: true });
      }

      const entryFile = join(destination, OVERLAY_ENTRY_FILE);
      const html = existsSync(entryFile) ? readFileSync(entryFile, "utf8") : "";

      const record: OverlayEntry = {
        overlayId,
        name: displayName,
        source: "imported",
        entryFile: OVERLAY_ENTRY_FILE,
        version: manifest?.version,
        author: manifest?.author,
        description: manifest?.description,
        fileCount: this.countFiles(destination),
        absoluteAssetWarning: html ? detectAbsoluteAssetRefs(html) : false,
      };

      logger.info("OverlayStorage", "Overlay imported", {
        overlayId,
        zipPath,
        fileCount: record.fileCount,
        absoluteAssetWarning: record.absoluteAssetWarning,
      });

      return { success: true, data: record };
    } catch (error) {
      logger.error("OverlayStorage", "Overlay import failed", error);
      return failure("zip_extract_failed", errorMessage(error));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  remove(overlayId: string): AppResult<{ overlayId: string }> {
    const dir = this.getUserOverlayDir(overlayId);

    if (!dir) {
      return { success: false, errorCode: "overlay_not_found", error: `Overlay not found: ${overlayId}` };
    }

    try {
      rmSync(dir, { recursive: true, force: true });
      logger.info("OverlayStorage", "Overlay removed", { overlayId });
      return { success: true, data: { overlayId } };
    } catch (error) {
      logger.error("OverlayStorage", "Overlay removal failed", error);
      return { success: false, errorCode: "overlay_delete_failed", error: errorMessage(error) };
    }
  }

  /** 读取该 Overlay 的清单（overlay.json 优先，兼容 zhenhai.overlay.json）。 */
  readManifestFor(overlayId: string): ParsedOverlayManifest {
    const root = this.resolveStaticRoot(overlayId);

    if (!root) {
      return { manifest: {}, warnings: [] };
    }

    for (const fileName of OVERLAY_MANIFEST_FILES) {
      const manifestPath = join(root, fileName);

      if (!existsSync(manifestPath)) {
        continue;
      }

      try {
        const raw = readFileSync(manifestPath, "utf8");
        return parseOverlayManifest(JSON.parse(raw), Buffer.byteLength(raw, "utf8"));
      } catch (error) {
        logger.warn("OverlayStorage", `Invalid overlay manifest (${overlayId}/${fileName})`, error);
        return { manifest: {}, warnings: ["manifest_invalid"] };
      }
    }

    return { manifest: {}, warnings: [] };
  }

  reveal(overlayId: string): boolean {
    const entryFile = this.getEntryFile(overlayId);

    if (!entryFile) {
      return false;
    }

    shell.showItemInFolder(entryFile);
    return true;
  }

  private discoverBuiltins(): Map<string, string> {
    const roots = new Map<string, string>();
    const defaultRoot = app.isPackaged
      ? join(process.resourcesPath, "overlay")
      : join(app.getAppPath(), "resources", "overlay");

    if (existsSync(join(defaultRoot, OVERLAY_ENTRY_FILE))) {
      roots.set(DEFAULT_OVERLAY_ID, defaultRoot);
    }

    const extraRoot = app.isPackaged
      ? join(process.resourcesPath, "overlays")
      : join(app.getAppPath(), "resources", "overlays");

    if (existsSync(extraRoot)) {
      for (const name of readdirSync(extraRoot)) {
        if (!isSafeOverlayId(name) || name === DEFAULT_OVERLAY_ID) {
          continue;
        }

        const dir = join(extraRoot, name);

        if (existsSync(join(dir, OVERLAY_ENTRY_FILE))) {
          roots.set(name, dir);
        }
      }
    }

    return roots;
  }

  private findOverlayRoot(tempDir: string): string | null {
    if (existsSync(join(tempDir, OVERLAY_ENTRY_FILE))) {
      return tempDir;
    }

    const directories = readdirSync(tempDir).filter((name) => {
      try {
        return statSync(join(tempDir, name)).isDirectory();
      } catch {
        return false;
      }
    });

    if (directories.length === 1) {
      const candidate = join(tempDir, directories[0]!);

      if (existsSync(join(candidate, OVERLAY_ENTRY_FILE))) {
        return candidate;
      }
    }

    return null;
  }

  private readManifest(root: string): OverlayManifest | null {
    const manifestPath = join(root, OVERLAY_MANIFEST_FILE);

    if (!existsSync(manifestPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as OverlayManifest;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      logger.warn("OverlayStorage", "Invalid overlay manifest", error);
      return null;
    }
  }

  private countFiles(dir: string): number {
    let total = 0;

    for (const name of readdirSync(dir)) {
      const target = join(dir, name);

      try {
        total += statSync(target).isDirectory() ? this.countFiles(target) : 1;
      } catch {
        // 忽略无法读取的条目
      }
    }

    return total;
  }
}

export const overlayStorage = OverlayStorageService.getInstance();