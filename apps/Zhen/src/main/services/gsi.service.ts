import { CSGOGSI } from '@zhenhai/csgogsi'
import { EventEmitter } from 'events'
import type { CSGO, Events } from '@zhenhai/csgogsi/types'
import type { GsiPipeline } from './gsi-pipeline.service'
import { logger } from './logger.service'

type ExcludedGsiEvent = 'raw' | 'newListener' | 'removeListener'

export type ForwardedGsiEvent = Exclude<keyof Events, ExcludedGsiEvent>

/**
 * 使用 Record<ForwardedGsiEvent, true> 保证这里必须包含
 * Events 里面除了 raw / newListener / removeListener 之外的所有事件。
 *
 * 如果后续 events.d.ts 增加事件但这里没补，会直接产生 TS 编译错误。
 */
const FORWARDED_GSI_EVENT_MAP: Record<ForwardedGsiEvent, true> = {
  data: true,
  roundEnd: true,
  matchEnd: true,
  overtime: true,
  kill: true,
  hurt: true,
  phaseChange: true,
  timeoutStart: true,
  timeoutEnd: true,
  pauseStart: true,
  pauseEnd: true,
  warmupStart: true,
  warmupEnd: true,
  mvp: true,
  freezetimeStart: true,
  freezetimeEnd: true,
  intermissionStart: true,
  intermissionEnd: true,
  defuseStart: true,
  defuseStop: true,
  bombPlantStart: true,
  bombPlantStop: true,
  bombPlant: true,
  bombExplode: true,
  bombDefuse: true
}

export const FORWARDED_GSI_EVENTS = Object.keys(FORWARDED_GSI_EVENT_MAP) as ForwardedGsiEvent[]

export class GsiService extends EventEmitter {
  private static instance: GsiService

  /**
   * 用于同步路径返回，避免每次请求都创建新的 Promise.resolve()。
   */
  private static readonly RESOLVED: Promise<void> = Promise.resolve()

  private gsi: CSGOGSI
  private pipeline: GsiPipeline | null = null

  /**
   * 避免异步 pipeline 错误重复刷屏。
   */
  private pipelineSyncErrorLogged = false

  private constructor() {
    super()

    this.gsi = new CSGOGSI()

    this.registerEvents()
    this.bindPreEmitTransform()

    logger.info('GsiService', 'Initialized')
  }

  static getInstance(): GsiService {
    if (!GsiService.instance) {
      GsiService.instance = new GsiService()
    }

    return GsiService.instance
  }

  setPipeline(pipeline: GsiPipeline): void {
    this.pipeline = pipeline
    logger.info('GsiService', 'Pipeline attached')
  }

  private bindPreEmitTransform(): void {
    const gsi = this.gsi as any

    if (typeof gsi.setPreEmitTransform !== 'function') {
      logger.warn(
        'GsiService',
        'Current CSGOGSI does not support setPreEmitTransform. Events will not be enhanced by pipeline.'
      )

      return
    }

    gsi.setPreEmitTransform((data: CSGO) => {
      return this.applyPipelineBeforeEmit(data)
    })
  }

  /**
   * 判断是否真的需要执行 pipeline。
   *
   * 如果没有任何 gsi:data 监听器，也没有任何 GSI 事件监听器，
   * 则跳过 pipeline，避免无意义 CPU 消耗。
   */
  private shouldApplyPipeline(): boolean {
    if (this.listenerCount('gsi:data') > 0) {
      return true
    }

    return FORWARDED_GSI_EVENTS.some((eventName) => {
      return this.listenerCount(eventName) > 0
    })
  }

  /**
   * 在 CSGOGSI 触发事件前执行同步 pipeline。
   */
  private applyPipelineBeforeEmit(data: CSGO): CSGO {
    const pipeline = this.pipeline

    if (!pipeline) {
      return data
    }

    if (!this.shouldApplyPipeline()) {
      return data
    }

    try {
      const result = pipeline.processSync(data)

      return result ?? data
    } catch (error) {
      if (!this.pipelineSyncErrorLogged) {
        this.pipelineSyncErrorLogged = true

        logger.error(
          'GsiService',
          'preEmit pipeline failed. When using CSGOGSI setPreEmitTransform, pipeline must be synchronous.',
          error
        )
      }

      this.emit('pipeline:error', error)

      return data
    }
  }

  /**
   * 现在 digest 不再二次执行 pipeline。
   *
   * 因为 pipeline 已经在 CSGOGSI.digest 内部、事件触发前执行。
   */
  digest(data: any): Promise<void> {
    try {
      const parsed = this.gsi.digest(data)

      if (this.listenerCount('rawData') > 0) {
        this.emit('rawData', data)
      }

      if (this.listenerCount('gsi:data') === 0) {
        return GsiService.RESOLVED
      }

      const enriched = parsed ?? this.gsi.current ?? this.gsi.last

      if (!enriched) {
        return GsiService.RESOLVED
      }

      this.emit('gsi:data', enriched)

      return GsiService.RESOLVED
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * 监听 CSGOGSI 的所有目标事件。
   *
   * 排除：
   * - raw
   * - newListener
   * - removeListener
   *
   * 注意：
   * 这些事件现在都已经是 preEmitTransform / pipeline 处理后的数据。
   */
  private registerEvents(): void {
    for (const eventName of FORWARDED_GSI_EVENTS) {
      const listener = (...args: any[]) => {
        if (this.listenerCount(eventName) > 0) {
          this.emit(eventName, ...args)
        }
      }

      ;(this.gsi as any).on(eventName, listener)
    }
  }
}
