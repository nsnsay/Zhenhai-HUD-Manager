# @zhenhai/csgogsi（薄壳包）

本包**不再包含解析器源码**。解析器完全来自 npm 上的上游 [`csgogsi`](https://github.com/osztenkurden/csgogsi)，
版本在 `package.json` 中精确锁定（当前 `6.0.1`）。这里只保留三类内容：

| 导出路径 | 内容 | 说明 |
| --- | --- | --- |
| `@zhenhai/csgogsi` | `export * from "csgogsi"` | 保持应用侧既有导入路径不变 |
| `@zhenhai/csgogsi/types` | 上游类型 + 本仓库业务类型 + 类型增补 | 见 `src/types.ts`、`src/info.ts`、`src/augment.ts` |
| `@zhenhai/csgogsi/gsi-vue` | Vue/Pinia 版 GSI store | 上游没有，见 `utils/gsi.ts` |

## 与上游的差异（求同存异）

上游 6.x 已提供：TypedEventEmitter、`normalizeMapName`、自定义 bombsite resolver、
`roundStart` / `observerTargetChange` / `mapEnd` 事件、新类型名 + deprecated 别名。
本仓库只在三处与上游不同：

1. **pre-emit 增强钩子（差异最大）**
   旧 fork 在 `CSGOGSI.digest` 内部加了 `setPreEmitTransform`；上游从来没有这个 API，6.x 也没有等价钩子。
   现在改为在应用侧继承 `CSGOGSI` 并覆写 `emit`，在事件派发前增强 `this.current`：
   `apps/Zhen/src/main/services/gsi-enrich.service.ts`。
   依赖上游文档化的不变量「`current` 先于 gameplay 事件赋值」，并有单测守着。
2. **业务注入字段的类型增补**
   `src/augment.ts` 通过 `declare module "csgogsi"` 合并 `_db`、`isFocused/isDead/isArmor*/isBomb`、
   武器拆解字段、`map.regularMR/overtimeMR`、`settings/matchinfo`。
   前提是上游发布物 `dist/index.d.mts` 为单文件内联声明（6.0.1 已实测满足）。
3. **Vue store**
   `utils/gsi.ts` 是上游没有的客户端封装（Socket.IO 连接、`gsi:*` 事件、`overlay:refresh` 自动刷新、frameSync）。

## 升级上游版本的步骤

1. `bun add csgogsi@<新版本> --cwd packages/csgogsi`（同时更新 apps/Zhen 里的精确版本）。
2. 检查 `node_modules/csgogsi/dist/index.d.mts`：
   - 仍是单文件内联声明 → `src/augment.ts` 无需改动；
   - 变成多文件/跨文件 re-export → 需要把 `src/augment.ts` 换成“应用侧类型 overlay”。
3. 跑 `bun run --cwd packages/csgogsi typecheck`、`bun run --cwd apps/Zhen typecheck`、
   `bun run --cwd apps/Zhen test`。
4. 跑 `bun run --cwd apps/Hai type-check` 与整体构建。
5. 若上游新增/删除事件，`apps/Zhen/src/main/services/gsi.service.ts` 的
   `FORWARDED_GSI_EVENT_MAP` 与 `utils/gsi.ts` 的 `GSI_EVENT_MAP` 会直接编译报错，
   按提示补齐即可（这是刻意的穷尽性保护）。