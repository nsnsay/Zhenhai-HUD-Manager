import { CSGOGSI } from "csgogsi";
import type { GameState } from "@zhenhai/csgogsi/types";

/**
 * [ZhenHai] 本地差异 #1：pre-emit 增强钩子。
 *
 * 旧 fork 曾在上游 CSGOGSI.digest 内部加过 setPreEmitTransform；上游 6.x 没有该 API，
 * 因此这里继承上游 CSGOGSI（值直接从 npm 包导入）并覆写 emit，在事件派发之前
 * 对 `this.current` 执行增强管线。
 *
 * 上游文档化的不变量：`current` 在 gameplay 事件（roundStart / roundEnd / bomb* /
 * mvp / phaseChange / data ...）派发之前赋值，`last` 仍指向上一个快照。
 * 依靠该不变量，本实现与旧 preEmitTransform 语义等价：
 * 事件回调里拿到的 players / team_ct / team_t / bomb.player 都已是增强后的对象。
 *
 * 契约：增强管线必须**原地修改**并返回同一个对象。返回新对象时事件载荷仍指向旧对象，
 * 这里只做一次告警（并在可能的情况下更新 current），不做深拷贝回填。
 */
export type GsiEnrichHandler = (data: GameState) => GameState | undefined;

export interface ZhenHaiGSIOptions {
  /** 是否需要执行增强；没有客户端监听时返回 false 可省掉整条管线的 CPU 开销。 */
  shouldEnrich: () => boolean;
  /** 同步增强管线。 */
  enrich: GsiEnrichHandler;
  /** 告警回调（默认忽略），由调用方注入 logger，避免本模块直接依赖 Electron。 */
  onWarn?: (message: string, meta?: unknown) => void;
}

/** 内部控制事件不参与增强。 */
const CONTROL_EVENTS: ReadonlySet<string | symbol> = new Set<string | symbol>([
  "raw",
  "newListener",
  "removeListener",
]);

export class ZhenHaiGSI extends CSGOGSI {
  private readonly shouldEnrich: () => boolean;
  private readonly enrichHandler: GsiEnrichHandler;
  private readonly onWarn: (message: string, meta?: unknown) => void;

  /** 已增强过的快照引用；同一快照只会增强一次。 */
  private enrichedSnapshot: GameState | null = null;
  private replaceWarned = false;

  constructor(options: ZhenHaiGSIOptions) {
    super();
    this.shouldEnrich = options.shouldEnrich;
    this.enrichHandler = options.enrich;
    this.onWarn = options.onWarn ?? (() => {});
  }

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    if (!CONTROL_EVENTS.has(event)) {
      this.enrichCurrentSnapshot(event);
    }

    return super.emit(event as never, ...(args as never[]));
  }

  /**
   * 幂等增强：同一份 current 快照在一次数据包内会被多个事件触发 emit，
   * 通过引用比较保证管线只跑一次。
   */
  private enrichCurrentSnapshot(event: string | symbol): void {
    const snapshot = this.current;

    if (!snapshot || snapshot === this.enrichedSnapshot || !this.shouldEnrich()) {
      return;
    }

    const result = this.enrichHandler(snapshot);
    const enriched = result ?? snapshot;

    // 解析器元信息随快照下发，供 Overlay 计算常规/加时回合总数。
    enriched.map.regularMR = this.regulationMR;
    enriched.map.overtimeMR = this.overtimeMR;

    if (enriched !== snapshot) {
      if (!this.replaceWarned) {
        this.replaceWarned = true;
        this.onWarn(
          "GSI 增强管线返回了新对象：后续事件载荷仍指向旧快照，请在中间件里原地修改并返回同一对象。",
          { event: String(event) },
        );
      }

      this.current = enriched;
    }

    this.enrichedSnapshot = enriched;
  }
}