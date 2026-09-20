import type { GameState } from "@zhenhai/csgogsi/types";

export type GsiMiddleware<T = GameState> = (data: T) => T | Promise<T>;

const isThenable = (value: unknown): value is PromiseLike<unknown> => {
  return value != null && typeof (value as PromiseLike<unknown>).then === "function";
};

/**
 * 同步优先的 GSI 增强管线。
 *
 * - 全部中间件同步返回时，`process` 完全同步执行；
 * - 一旦某个中间件返回 Promise/thenable，则切换到异步链；
 * - `processSync` 用于必须在事件派发前完成的场景（上游 preEmit 语义），
 *   检测到异步中间件会直接抛错。
 */
export class GsiPipeline<T = GameState> {
  private middlewares: GsiMiddleware<T>[] = [];

  use(middleware: GsiMiddleware<T>): this {
    this.middlewares.push(middleware);
    return this;
  }

  process(data: T): T | Promise<T> {
    const middlewares = this.middlewares;
    const length = middlewares.length;

    if (length === 0) {
      return data;
    }

    try {
      let result: T = data;

      for (let i = 0; i < length; i++) {
        const next = middlewares[i]!(result);

        if (isThenable(next)) {
          return this.resume(next, middlewares, i + 1);
        }

        result = next;
      }

      return result;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  processSync(data: T): T {
    const middlewares = this.middlewares;
    const length = middlewares.length;

    if (length === 0) {
      return data;
    }

    let result: T = data;

    for (let i = 0; i < length; i++) {
      const next = middlewares[i]!(result);

      if (isThenable(next)) {
        throw new Error(
          "[GsiPipeline] processSync does not support async middleware. " +
            "When using CSGOGSI preEmitTransform, all middlewares must be synchronous.",
        );
      }

      result = next;
    }

    return result;
  }

  private resume(
    pending: PromiseLike<unknown>,
    middlewares: GsiMiddleware<T>[],
    start: number,
  ): Promise<T> {
    return Promise.resolve(pending).then((value) => {
      let result = value as T;

      for (let i = start; i < middlewares.length; i++) {
        const next = middlewares[i]!(result);

        if (isThenable(next)) {
          return this.resume(next, middlewares, i + 1);
        }

        result = next;
      }

      return result;
    });
  }
}