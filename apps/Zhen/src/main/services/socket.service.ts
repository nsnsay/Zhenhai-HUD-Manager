import { Server as SocketIOServer } from 'socket.io'
import type http from 'http'
import { FORWARDED_GSI_EVENTS, type GsiService } from './gsi.service'
import { logger } from './logger.service'

export class SocketService {
  private static instance: SocketService

  private io: SocketIOServer

  private gsiService: GsiService | null = null
  private gsiAttached = false
  private connectionCount = 0

  /**
   * 所有需要挂载到 GsiService 的监听器。
   *
   * key 是 GsiService 的事件名：
   * - `gsi:data`
   * - `roundEnd`
   * - `matchEnd`
   * - `kill`
   * - ...
   */
  private readonly handlers = new Map<string, (...args: any[]) => void>()

  private constructor(server: http.Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    /**
     * gsi:data 是 pipeline 处理后的主数据事件。
     */
    this.handlers.set('gsi:data', (...args: any[]) => {
      if (this.connectionCount > 0) {
        this.io.emit('gsi:data', ...args)
      }
    })

    /**
     * 其他 CSGOGSI 事件统一转发为 `gsi:事件名`。
     *
     * 例如：
     * - roundEnd -> gsi:roundEnd
     * - matchEnd -> gsi:matchEnd
     * - kill -> gsi:kill
     * - hurt -> gsi:hurt
     * - bombPlant -> gsi:bombPlant
     *
     * 注意：
     * `data` 事件不在这里转发，避免和 `gsi:data` 重复。
     */
    for (const eventName of FORWARDED_GSI_EVENTS) {
      if (eventName === 'data') {
        continue
      }

      this.handlers.set(eventName, (...args: any[]) => {
        if (this.connectionCount > 0) {
          this.io.emit(`gsi:${eventName}`, ...args)
        }
      })
    }

    this.io.on('connection', (socket) => {
      logger.info('SocketIO', 'Client connected', {
        id: socket.id,
        connectionCount: this.connectionCount + 1
      })

      /**
       * 第一个客户端连接时，挂载 GSI 事件。
       * 没有客户端时不监听 GSI，避免 pipeline / Socket.IO 序列化消耗。
       */
      if (this.connectionCount === 0) {
        this.attachGsiEvents()
      }

      this.connectionCount++

      socket.on('disconnect', (reason) => {
        const previousCount = this.connectionCount

        if (this.connectionCount > 0) {
          this.connectionCount--
        }

        if (this.connectionCount === 0) {
          this.detachGsiEvents()
        }

        logger.info('SocketIO', 'Client disconnected', {
          id: socket.id,
          reason,
          previousCount,
          connectionCount: this.connectionCount
        })
      })
    })

    logger.info('SocketService', 'Initialized')
  }

  static init(server: http.Server): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService(server)
    }

    return SocketService.instance
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      throw new Error('SocketService not initialized. Call init() first.')
    }

    return SocketService.instance
  }

  bindGsi(gsiService: GsiService): void {
    if (this.gsiService !== gsiService) {
      this.detachGsiEvents()
      this.gsiService = gsiService
    }

    /**
     * 如果绑定 GSI 时已经有客户端连接，则立即挂载事件。
     */
    if (this.connectionCount > 0) {
      this.attachGsiEvents()
    }

    logger.info('SocketService', 'GSI events bound')
  }

  broadcast(event: string, data: any): void {
    if (this.connectionCount === 0) {
      return
    }

    this.io.emit(event, data)
  }

  private attachGsiEvents(): void {
    if (!this.gsiService || this.gsiAttached) {
      return
    }

    for (const [eventName, handler] of this.handlers) {
      this.gsiService.on(eventName, handler)
    }

    this.gsiAttached = true
  }

  private detachGsiEvents(): void {
    if (!this.gsiService || !this.gsiAttached) {
      return
    }

    for (const [eventName, handler] of this.handlers) {
      this.gsiService.off(eventName, handler)
    }

    this.gsiAttached = false
  }
}
