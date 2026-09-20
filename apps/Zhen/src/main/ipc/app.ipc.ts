import { ipcMain, dialog, app } from "electron";
import { getGamePath } from "steam-game-path";
import { join } from "path";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { logger } from "../services/logger.service";
import { serverService } from "../services/server.service";
import { errorMessage } from "../../shared/errors";

const GSI_CFG_FILE_NAME = "gamestate_integration_zhenhai.cfg";

/**
 * 解析 GSI 配置文件的来源路径。
 *
 * 打包后优先使用 electron-builder extraResources 布局
 * （<resourcesPath>/gamestate_integration_zhenhai.cfg）；
 * 同时兼容旧版本 asarUnpack 布局（app.asar.unpacked/resources/...），
 * 避免升级安装包格式或使用旧包时出现 ENOENT。
 */
function resolveGsiCfgSource(): string | null {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, GSI_CFG_FILE_NAME),
        join(process.resourcesPath, "app.asar.unpacked", "resources", GSI_CFG_FILE_NAME),
        join(process.resourcesPath, "app.asar.unpacked", GSI_CFG_FILE_NAME),
      ]
    : [join(__dirname, "../../resources", GSI_CFG_FILE_NAME)];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function registerAppIpc(): void {
  // 1. 自动获取 CS2 路径
  ipcMain.handle("app:get-cs2-path", async () => {
    try {
      const data = getGamePath(730); // 730 is CS2/CSGO AppID
      if (data && data.game && data.game.path) {
        return { success: true, data: data.game.path };
      }
      return { success: false, error: "CS2 not found via Steam" };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  // 2. 手动选择文件夹
  ipcMain.handle("app:select-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select CS2 Root Directory (e.g., .../Counter-Strike Global Offensive)",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    return { success: true, data: result.filePaths[0] };
  });

  // 3. 安装 CFG 文件
  ipcMain.handle("app:install-cfg", async (_, cs2Path: unknown) => {
    try {
      if (typeof cs2Path !== "string" || cs2Path.trim() === "") {
        return { success: false, error: "CS2 路径为空，请重新选择游戏目录。" };
      }

      const normalizedCs2Path = cs2Path.trim();

      if (!existsSync(normalizedCs2Path)) {
        return { success: false, error: `CS2 路径不存在：${normalizedCs2Path}` };
      }

      const cfgSource = resolveGsiCfgSource();

      if (!cfgSource) {
        return {
          success: false,
          error: `未找到 ${GSI_CFG_FILE_NAME}，请重新安装或更新应用。`,
        };
      }

      const targetDir = join(normalizedCs2Path, "game", "csgo", "cfg");
      const targetFile = join(targetDir, GSI_CFG_FILE_NAME);

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      copyFileSync(cfgSource, targetFile);

      if (!existsSync(targetFile)) {
        return { success: false, error: `CFG 写入校验失败：${targetFile}` };
      }

      logger.info("AppIpc", "GSI cfg installed", {
        source: cfgSource,
        target: targetFile,
      });

      return { success: true, data: targetFile };
    } catch (error) {
      logger.error("AppIpc", "GSI cfg install failed", error);
      return { success: false, error: errorMessage(error) };
    }
  });

  // 4. 应用「允许局域网访问」设置（立即重新监听）
  ipcMain.handle("app:apply-network-settings", async (_, allowLanAccess: unknown) => {
    return serverService.applyLanAccess(allowLanAccess === true);
  });
}