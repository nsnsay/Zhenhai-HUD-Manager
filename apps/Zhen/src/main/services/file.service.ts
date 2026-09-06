import { app } from "electron";
import { join, resolve } from "path";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { logger } from "./logger.service";

export class FileService {
  private static instance: FileService;
  private assetsDir: string;

  private constructor() {
    this.assetsDir = join(app.getPath("documents"), "ZhenHai", "assets");
    mkdirSync(this.assetsDir, { recursive: true });
  }

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

    save(base64: string, fileName: string, category: string): string {
    const safeCategory = category.replace(/[\\/]/g, "_").replace(/\.\./g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFileName = fileName.replace(/[\\/]/g, "_").replace(/\.\./g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = join(this.assetsDir, safeCategory);
    mkdirSync(dir, { recursive: true });

    const base64Data = base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    writeFileSync(join(dir, safeFileName), buffer);
    logger.info("FileService", "File saved", {
      relativePath: `${safeCategory}/${safeFileName}`,
      bytes: buffer.length,
    });
    return `${safeCategory}/${safeFileName}`;
  }

    delete(relativePath: string): boolean {
    const safeRelativePath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const filePath = resolve(this.assetsDir, safeRelativePath);
    const assetsRoot = resolve(this.assetsDir);
    if (filePath !== assetsRoot && !filePath.startsWith(assetsRoot + "\\") && !filePath.startsWith(assetsRoot + "/")) {
      return false;
    }
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      logger.info("FileService", "File deleted", { relativePath: safeRelativePath });
      return true;
    }
    return false;
  }

    getAssetsDir(): string {
    return this.assetsDir;
  }
}
