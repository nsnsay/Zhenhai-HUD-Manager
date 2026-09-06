import { ipcMain } from 'electron'
import type { LoggerPayload } from '../../shared/ipc'
import { logger } from '../services/logger.service'

export function registerLoggerIpc(): void {
  ipcMain.handle('logger:write', (_event, payload: LoggerPayload) => {
    logger.write({
      level: payload?.level ?? 'info',
      source: typeof payload?.source === 'string' ? payload.source.slice(0, 80) : 'Renderer',
      message:
        typeof payload?.message === 'string'
          ? payload.message.slice(0, 2000)
          : String(payload?.message ?? ''),
      meta: payload?.meta
    })
    return true
  })

  ipcMain.handle('logger:read', (_event, limit?: number) => {
    return logger.readRecentLogs(Number.isFinite(limit) ? Number(limit) : 500)
  })
}
