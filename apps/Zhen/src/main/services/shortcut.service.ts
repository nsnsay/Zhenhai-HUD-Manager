import { globalShortcut } from 'electron'
import type { SocketService } from './socket.service'
import { logger } from './logger.service'

export class ShortcutService {
  private static instance: ShortcutService
  private socketService: SocketService | null = null
  private currentShortcut: string = ''

  static getInstance(): ShortcutService {
    if (!ShortcutService.instance) {
      ShortcutService.instance = new ShortcutService()
    }
    return ShortcutService.instance
  }

  setSocketService(socketService: SocketService): void {
    this.socketService = socketService
  }

  register(accelerator: string): boolean {
    this.unregister()

    if (!accelerator || accelerator.trim() === '') {
      logger.warn('ShortcutService', 'Empty accelerator, skipping registration')
      return false
    }

    this.currentShortcut = accelerator
    const success = globalShortcut.register(accelerator, () => {
      logger.info('ShortcutService', `Shortcut pressed, refreshing overlay: ${accelerator}`)
      this.socketService?.broadcast('overlay:refresh', { timestamp: Date.now() })
    })

    if (!success) {
      logger.error('ShortcutService', `Failed to register shortcut: ${accelerator}`)
    } else {
      logger.info('ShortcutService', `Registered shortcut: ${accelerator}`)
    }

    return success
  }

  unregister(): void {
    if (this.currentShortcut) {
      globalShortcut.unregister(this.currentShortcut)
      logger.info('ShortcutService', `Unregistered shortcut: ${this.currentShortcut}`)
      this.currentShortcut = ''
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }

  getCurrent(): string {
    return this.currentShortcut
  }
}
