import { ipcMain, dialog, app } from 'electron'
import { getGamePath } from 'steam-game-path'
import { join } from 'path'
import { existsSync, copyFileSync, mkdirSync } from 'fs'

export function registerAppIpc() {
  // 1. 自动获取 CS2 路径
  ipcMain.handle('app:get-cs2-path', async () => {
    try {
      const data = getGamePath(730) // 730 is CS2/CSGO AppID
      if (data && data.game && data.game.path) {
        return { success: true, data: data.game.path }
      }
      return { success: false, error: 'CS2 not found via Steam' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // 2. 手动选择文件夹
  ipcMain.handle('app:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select CS2 Root Directory (e.g., .../Counter-Strike Global Offensive)'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }
    return { success: true, data: result.filePaths[0] }
  })

  // 3. 安装 CFG 文件
  ipcMain.handle('app:install-cfg', async (_, cs2Path: string) => {
    try {
      // 区分开发环境和生产环境的 resources 路径
      const isDev = !app.isPackaged
      const cfgSource = isDev
        ? join(__dirname, '../../resources/gamestate_integration_zhenhai.cfg')
        : join(process.resourcesPath, 'gamestate_integration_zhenhai.cfg')

      const targetDir = join(cs2Path, 'game', 'csgo', 'cfg')
      const targetFile = join(targetDir, 'gamestate_integration_zhenhai.cfg')

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      copyFileSync(cfgSource, targetFile)
      return { success: true, data: targetFile }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })
}
