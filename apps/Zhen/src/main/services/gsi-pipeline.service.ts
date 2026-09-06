export type GsiMiddleware = (data: any) => any | Promise<any>

const isThenable = (value: unknown): value is PromiseLike<any> => {
  return value != null && typeof (value as PromiseLike<any>).then === 'function'
}

export class GsiPipeline {
  private middlewares: GsiMiddleware[] = []

  use(middleware: GsiMiddleware): this {
    this.middlewares.push(middleware)
    return this
  }

  /**
   * 异步友好的 pipeline。
   *
   * 如果所有中间件都是同步的，则完全同步返回结果。
   * 只有某个中间件返回 Promise / thenable 时，才进入异步链。
   */
  process(data: any): any | Promise<any> {
    const middlewares = this.middlewares
    const length = middlewares.length

    if (length === 0) {
      return data
    }

    try {
      let result = data

      for (let i = 0; i < length; i++) {
        result = middlewares[i](result)

        if (isThenable(result)) {
          return this.resume(result, middlewares, i + 1)
        }
      }

      return result
    } catch (error) {
      return Promise.reject(error)
    }
  }

  /**
   * 同步版 pipeline。
   *
   * 用于 CSGOGSI.preEmitTransform。
   *
   * 注意：
   * - 不允许任何中间件返回 Promise / thenable。
   * - 如果检测到异步中间件，会直接抛出错误。
   */
  processSync(data: any): any {
    const middlewares = this.middlewares
    const length = middlewares.length

    if (length === 0) {
      return data
    }

    let result = data

    for (let i = 0; i < length; i++) {
      result = middlewares[i](result)

      if (isThenable(result)) {
        throw new Error(
          '[GsiPipeline] processSync does not support async middleware. ' +
            'When using CSGOGSI preEmitTransform, all middlewares must be synchronous.'
        )
      }
    }

    return result
  }

  private resume(
    pending: PromiseLike<any>,
    middlewares: GsiMiddleware[],
    start: number
  ): Promise<any> {
    return Promise.resolve(pending).then((value) => {
      let result = value

      for (let i = start; i < middlewares.length; i++) {
        result = middlewares[i](result)

        if (isThenable(result)) {
          return this.resume(result, middlewares, i + 1)
        }
      }

      return result
    })
  }
}
