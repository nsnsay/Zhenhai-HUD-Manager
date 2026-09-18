import { EventEmitter } from "events";
import type { Events, GameState, GameStateRaw } from "@zhenhai/csgogsi/types";
import { ZhenHaiGSI } from "./gsi-enrich.service";
import type { GsiPipeline } from "./gsi-pipeline.service";
import { logger } from "./logger.service";

type ExcludedGsiEvent = "raw" | "newListener" | "removeListener";

export type ForwardedGsiEvent = Exclude<keyof Events, ExcludedGsiEvent>;

/**
 * 使用 Record<ForwardedGsiEvent, true> 保证这里必须包含 Events 里面除了
 * raw / newListener / removeListener 之外的所有事件。
 *
 * 上游 csgogsi 6.x 新增 roundStart / observerTargetChange / mapEnd 后，
 * 这里如果没有补齐会直接产生 TS 编译错误（这是刻意的保护）。
 */
const FORWARDED_GSI_EVENT_MAP: Record<ForwardedGsiEvent, true> = {
  data: true,
  roundStart: true,
  observerTargetChange: true,
  roundEnd: true,
  mapEnd: true,
  // @deprecated 上游 6.x 已用 mapEnd 取代 matchEnd；这里继续转发以兼容既有前端订阅。
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
  bombDefuse: true,
};

export const FORWARDED_GSI_EVENTS = Object.keys(FORWARDED_GSI_EVENT_MAP) as ForwardedGsiEvent[];

/**
 * 上游 TypedEventEmitter 的 on/off 是按单个事件名做类型推导的，
 * 这里用联合事件名批量注册，因此退化成结构化的最小接口。
 */
type GsiEventTarget = {
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  off: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

export class GsiService extends EventEmitter {
  private static instance: GsiService;

  /**
   * 用于同步路径返回，避免每次请求都创建新的 Promise.resolve()。
   */
  private static readonly RESOLVED: Promise<void> = Promise.resolve();

  private gsi: ZhenHaiGSI;
  private gsiEvents: GsiEventTarget;
  private pipeline: GsiPipeline | null = null;

  /**
   * 避免增强管线的同步异常重复刷屏。
   */
  private pipelineSyncErrorLogged = false;

  private constructor() {
    super();

    this.gsi = new ZhenHaiGSI({
      shouldEnrich: () => this.shouldApplyPipeline(),
      enrich: (data) => this.applyEnrichment(data),
      onWarn: (message, meta) => logger.warn("GsiService", message, meta),
    });
    this.gsiEvents = this.gsi as unknown as GsiEventTarget;

    this.registerEvents();

    logger.info("GsiService", "Initialized");
  }

  static getInstance(): GsiService {
    if (!GsiService.instance) {
      GsiService.instance = new GsiService();
    }

    return GsiService.instance;
  }

  setPipeline(pipeline: GsiPipeline): void {
    this.pipeline = pipeline;
    logger.info("GsiService", "Pipeline attached");
  }

  /**
   * 判断是否真的需要执行增强管线。
   *
   * 如果没有任何 gsi:data 监听器，也没有任何 GSI 事件监听器，
   * 则跳过管线，避免无意义 CPU 消耗。
   */
  private shouldApplyPipeline(): boolean {
    if (this.listenerCount("gsi:data") > 0) {
      return true;
    }

    return FORWARDED_GSI_EVENTS.some((eventName) => {
      return this.listenerCount(eventName) > 0;
    });
  }

  /**
   * [ZhenHai] 增强入口。
   *
   * 旧 fork 在 CSGOGSI.digest 内部调用 setPreEmitTransform；上游 6.x 没有该钩子，
   * 现在由 ZhenHaiGSI 覆写 emit，在事件派发前同步调用这里，语义保持一致：
   * roundEnd / mvp / bombPlant / phaseChange 等事件携带的 players / team / bomb.player
   * 都已经是增强后的对象。
   */
  private applyEnrichment(data: GameState): GameState {
    const pipeline = this.pipeline;

    if (!pipeline) {
      return data;
    }

    try {
      const result = pipeline.processSync(data);

      return (result ?? data) as GameState;
    } catch (error) {
      if (!this.pipelineSyncErrorLogged) {
        this.pipelineSyncErrorLogged = true;

        logger.error(
          "GsiService",
          "GSI 增强管线执行失败：同步管线不允许中间件返回 Promise。",
          error,
        );
      }

      this.emit("pipeline:error", error);

      return data;
    }
  }

  /**
   * 增强已经在 CSGOGSI 内部、事件触发前完成，这里不再二次执行管线。
   */
  digest(data: GameStateRaw): Promise<void> {
    try {
      const parsed = this.gsi.digest(data);

      if (this.listenerCount("rawData") > 0) {
        this.emit("rawData", data);
      }

      if (this.listenerCount("gsi:data") === 0) {
        return GsiService.RESOLVED;
      }

      const enriched = parsed ?? this.gsi.current ?? this.gsi.last;

      if (!enriched) {
        return GsiService.RESOLVED;
      }

      this.emit("gsi:data", enriched);

      return GsiService.RESOLVED;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 监听上游 CSGOGSI 的所有目标事件。
   *
   * 排除：raw / newListener / removeListener。
   * 这些事件携带的都是增强后的数据。
   */
  private registerEvents(): void {
    for (const eventName of FORWARDED_GSI_EVENTS) {
      const listener = (...args: unknown[]) => {
        if (this.listenerCount(eventName) > 0) {
          this.emit(eventName, ...args);
        }
      };

      this.gsiEvents.on(eventName, listener);
    }
  }
}