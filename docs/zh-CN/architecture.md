# 架构

[English](../en-US/architecture.md) · [返回 README](../../README_ZH.md)

ZhenHai HUD Manager 由三部分组成：持有数据的 Electron 桌面端、负责分发实时比赛状态的本地 Express + Socket.IO 服务，以及独立构建的直播 Overlay 前端。

## 仓库结构

```text
Zhenhai-HUD-Manager/
├── apps/
│   ├── Zhen/                     # Electron 应用：管理端界面 + 本地服务 + Overlay 窗口
│   │   ├── src/main/             # 主进程（Express、Socket.IO、LowDB、GSI、快捷键、更新器）
│   │   ├── src/preload/          # 通过 contextBridge 暴露的 window.api
│   │   ├── src/renderer/         # Vue 3 管理端界面（路由、store、组件）
│   │   ├── src/shared/           # main / preload / renderer 共用的类型与纯函数
│   │   ├── resources/            # GSI 配置、构建产物 Overlay、额外内置 Overlay
│   │   └── electron-builder.yml  # 打包、NSIS 产物与更新发布配置
│   └── Hai/                      # Overlay 前端（Vue 3），构建输出到 apps/Zhen/resources/overlay
├── packages/
│   └── csgogsi/                  # 基于上游 csgogsi 6.0.1 的适配层
├── docs/                         # 文档（zh-CN / en-US 镜像）
└── scripts/                      # 仓库工具（docs:check）
```

## 进程模型

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 主进程 | `apps/Zhen/src/main` | HTTP + Socket.IO 服务、LowDB 集合、GSI 解析与增强、Overlay 窗口生命周期、全局快捷键、自动更新、日志 |
| Preload | `apps/Zhen/src/preload` | 面向管理端与 Overlay 窗口的 `contextBridge` 接口（`window.api`） |
| 渲染进程（管理端） | `apps/Zhen/src/renderer` | Vue 3 + Pinia + Nuxt UI 管理界面（数据库、工具箱、Overlay 管理、设置） |
| 渲染进程（Overlay） | `apps/Hai` | 直播画面使用的 HUD；生产构建会复制到 `apps/Zhen/resources/overlay` |
| 适配包 | `packages/csgogsi` | 重新导出 `csgogsi` 6.0.1，补充 ZhenHai 业务类型与 Vue GSI store |
| 共享层 | `apps/Zhen/src/shared` | 类型、常量与纯函数，供 main / preload / renderer 与单元测试共用 |

## 数据流

1. CS2 按 `gamestate_integration_zhenhai.cfg` 的配置，把 GSI 数据 POST 到 `http://localhost:1469/gsi`。
2. `GsiService` 把数据交给 csgogsi 解析器。
3. 在任何 gameplay 事件派发之前，`ZhenHaiGSI`（本地继承上游 `CSGOGSI` 的子类）会对 `this.current` 执行增强管线，因此事件回调里拿到的 players、teams、bomb 都已经是增强后的对象。
4. 各中间件合并数据库信息：玩家与队伍的 `_db`、武器/护甲/炸弹派生字段、`map.regularMR` / `map.overtimeMR`，以及生效中的 `data.settings`。
5. `GsiService` 重新派发 `gsi:data` 与 `gsi:<event>`，Socket.IO 服务转发给已连接客户端（仅在存在客户端连接时转发）。
6. Overlay 页面（内置、导入或开发地址）订阅 Socket.IO 并渲染画面。

## 本地服务

Express 服务监听 `1469` 端口，默认绑定 `127.0.0.1`。路由分为几组：GSI 入口（`/gsi`）、日志（`/logger`）、REST（`/api/*`）、上传资源（`/assets`）与 Overlay 静态托管（`/overlay`、`/hud`、`/overlays/<id>`）。

完整路由表见 [HTTP API](./http-api.md)，Socket.IO 契约见 [实时 API](./realtime-api.md)。

## 数据存储

应用数据存放在 `%USERPROFILE%\Documents\ZhenHai\`：

| 路径 | 内容 |
| --- | --- |
| `players.json`、`teams.json`、`matchs.json`、`tournaments.json`、`extras.json`、`overlays.json` | 每个集合一个 LowDB 文件；`extras` 同时保存应用设置记录 |
| `assets/` | 从管理端上传的图片（选手照片、队伍队标），按分类存放 |
| `overlays/<id>/` | 从 zip 导入的第三方 Overlay 解压目录 |
| `logs/` | 滚动应用日志 |

## Overlay 加载

| 来源 | 磁盘位置 | 对外路径 |
| --- | --- | --- |
| 内置默认 | `apps/Zhen/resources/overlay` | `/overlay/`（别名 `/hud`） |
| 额外内置 | `apps/Zhen/resources/overlays/<id>` | `/overlays/<id>/` |
| 已导入 | `<文档>/ZhenHai/overlays/<id>` | `/overlays/<id>/` |
| 开发 | 任意 `http(s)` 地址，仅未打包构建可用 | 该地址 + 可选路由 |

内置默认 Overlay 由 `apps/Hai` 以 Vite `base: "/overlay/"` 构建，因此固定挂在 `/overlay/`。对 `/overlays/default/*` 的请求会以 302 跳转到 `/overlay/*`，而不会从第二个路径重复提供同一份资源。

## 增强管线

| 管线 | 作用 |
| --- | --- |
| `player.pipeline.ts` | 按 SteamID 把玩家匹配到数据库记录并写入 `_db`，设置 `isFocused` / `isDead` / 护甲 / 炸弹等标记，把武器拆分为 `primaryweapon`、`secondaryweapon`、`knifeweapon`、`activeweapon` 与 `grenades`，并归一化观战槽位 |
| `team.pipeline.ts` | 把队伍记录与阵容写入 `_db`，结合 Live 比赛解析队标与比分 |
| `match.pipeline.ts` | 解析当前 Live 比赛的元信息（队伍、比分、地图信息） |
| `settings.pipeline.ts` | 把生效设置注入 `data.settings`（见 [Overlay 清单](./overlay-format.md)） |
| `observer-slot.ts` | 把 CS2 观战槽位映射到 HUD 槽位：`0..9` 变为 `slot + 1`，`10` 变为 `0`，`11+` 保持原值 |

## 历史

项目最初分为 `Void-HUD-Manager` 与 `Void-HUD-Overlay` 两个仓库，后来重建为单一的 Turborepo 工作区 `ZhenHai-HUD-Manager`：管理端、Overlay 前端与 GSI 适配层现在并排放在 `apps/` 与 `packages/` 下。
