# 开发

[English](../en-US/development.md) · [返回 README](../../README_ZH.md)

从源码运行、类型检查与构建 ZhenHai HUD Manager 所需的全部信息。

## 环境要求

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Bun | `1.3.14` 或更新 | 由根 `package.json` 的 `packageManager` 声明，用于安装依赖与执行脚本 |
| Node.js | `^22.18.0` 或 `>=24.12.0` | `apps/Hai` 的要求；`csgogsi` 要求 Node `>=22.12.0` |
| Windows | 10 / 11 | 受支持的目标平台：窗口材质（acrylic/mica）、Overlay 鼠标穿透与 NSIS 安装包都以 Windows 为先；`build:mac` / `build:linux` 脚本虽然存在，但不在此维护 |

## 安装

```bash
bun install
```

`apps/Zhen` 的 `postinstall` 会执行 `electron-builder install-app-deps`；`bufferutil` / `utf-8-validate` / `sass-embedded` 等原生模块已声明为受信任依赖。

## 开发服务器

```bash
bun run dev        # 通过 Turborepo 同时启动两个应用
bun run dev:zhen   # 仅 Electron 管理端（electron-vite dev --watch）
bun run dev:hai    # 仅 Overlay（Vite 开发服务器 http://localhost:1467/overlay/）
```

开发 Overlay 时，在 **Overlays** 页面添加一条指向 `http://localhost:1467/overlay/`（可附加路由）的开发条目并选中它，Overlay 窗口就会直接从 Vite 加载并支持热更新。开发条目只能在未打包构建中创建。

## 脚本

| 位置 | 脚本 | 用途 |
| --- | --- | --- |
| 根 | `dev` / `dev:zhen` / `dev:hai` | 通过 Turborepo 启动开发服务器 |
| 根 | `build` | 先构建 `apps/Hai`，再打包 Windows 版 `apps/Zhen` |
| 根 | `typecheck` | 对工作区执行 `turbo run typecheck` |
| 根 | `lint` / `format` / `clean` | 分别执行 `oxlint`、`oxfmt`、`turbo run clean` |
| 根 | `docs:check` | 校验 README/docs 链接、双语镜像一致性与占位符 |
| `apps/Zhen` | `dev` | `electron-vite dev --watch` |
| `apps/Zhen` | `build` | `typecheck` → `electron-vite build` → `pack:overlay` |
| `apps/Zhen` | `build:win` | 递增补丁版本号后构建，并执行 `electron-builder --win` |
| `apps/Zhen` | `test` | `node --test` 单元测试 |
| `apps/Zhen` | `typecheck` | `typecheck:node` + `typecheck:web` + `typecheck:test` |
| `apps/Zhen` | `pack:overlay` | 安装内置 Overlay 到 `resources/overlay` 并打包到仓库根目录 `dist/` |
| `apps/Hai` | `dev` / `build` / `preview` | Vite 开发服务器、类型检查加生产构建、本地预览 |
| `apps/Hai` | `pack` | 构建 → 校验 → 生成清单 → 产出 `dist/zhenhai-<bundle>-<version>.zip` |
| `apps/Hai` | `type-check` | `vue-tsc --build` |

Overlay 前端项目在自己的 `package.json` 里用 `zhenhaiOverlay` 声明打包元数据（`bundleName`、`displayName`，以及可选的 `description`、`author`、`versionFrom`、`installTo`）。`bun run pack` 会构建、校验并把 `name`/`description`/`author`/`version` 写入产物清单，再把 zip 输出到仓库根目录 `dist/`；声明了 `installTo` 的项目（内置默认 Overlay）还会把产物镜像到 `apps/Zhen/resources/overlay`。其它 Overlay 项目用 `bun <仓库>/apps/Hai/scripts/pack-overlay.mjs --project <dir>` 独立出包，不触碰管理端资源目录。

## 测试

```bash
bun run --cwd apps/Zhen test
```

测试基于 `node --test`，不引入额外依赖，覆盖快捷键归一化、引用清理、语言解析、语言包键一致性、Overlay 清单（解析、设置合成、快捷键绑定）、zip 校验、Overlay URL 解析、观战槽位映射与 GSI 增强钩子。

`apps/Hai` 带有 Vitest 与 Playwright 配置，供 Overlay 侧后续补充测试；本仓库目前通过 `bun run --cwd apps/Hai type-check` 做回归验证。

## 类型检查

```bash
bun run typecheck                 # 整个工作区
bun run --cwd apps/Zhen typecheck # 主进程 + 渲染进程 + 测试
bun run --cwd apps/Hai type-check # Overlay
```

## 约定

- 默认用 `const`，只有需要重新赋值时才用 `let`，不使用 `var`。
- 不用裸 `any`：外部输入先校验再收窄，异常统一用 `unknown` 配合共享的 `errorMessage()` 处理。
- 该锁版本就锁版本（`csgogsi` 固定 `6.0.1`），lockfile 一并提交。
- 纯逻辑放在 `apps/Zhen/src/shared`（或 `pipelines/`），以便脱离 Electron 与 DOM 直接单测。
- 渲染层统一使用 Vue 3 `<script setup lang="ts">`，Pinia store 位于 `renderer/src/stores`，纯函数位于 `renderer/src/utils`。
- 管理端面向用户的文案通过 `vue-i18n`（`renderer/src/locales`）本地化；日志与主进程文案保持英文，便于检索。
