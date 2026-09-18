/**
 * [ZhenHai] 薄壳入口。
 *
 * 解析器实现完全来自 npm 上的上游 `csgogsi`（版本在 package.json 精确锁定），
 * 本包只负责 re-export，从而保持应用侧 `@zhenhai/csgogsi` 导入路径不变。
 */
export * from "csgogsi";