# Zhen-Hai HUD Manager

![Platform](https://img.shields.io/badge/platform-Windows%20x64-informational)
![Bun](https://img.shields.io/badge/bun-1.3.14-black)
![Vue](https://img.shields.io/badge/vue-3-42b883)
[![Downloads](https://img.shields.io/github/downloads/nsnsay/Zhenhai-HUD-Manager/total)](https://github.com/nsnsay/Zhenhai-HUD-Manager/releases)

[English](./README.md) | [简体中文](./README_ZH.md)

> 前身为 **Void HUD Manager**，现已全面重构并正式更名为 **Zhen-Hai HUD Manager**。
> “镇海（ZhenHai）”一名源自中国浙江海宁的占鳌塔。

## 简介

Zhen-Hai HUD Manager 是一款面向 CS 赛事直播场景的 HUD 管理工具：管理赛事、队伍、玩家与比赛数据，增强来自 CS2 的实时比赛状态，并把直播画面上使用的 HUD 提供给 OBS 或 vMix。

相较于旧版 Void HUD Manager，本次重构在架构、界面与操作流程上都有较大改进：原先的 `Void-HUD-Manager` 与 `Void-HUD-Overlay` 双仓库合并为单一 Turborepo 工作区，代码结构按可维护性重新组织，赛事、队伍、玩家与比赛的使用流程也做了重新设计。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [架构](./docs/zh-CN/architecture.md) | 进程模型、数据流、存储结构、Overlay 加载方式 |
| [开发](./docs/zh-CN/development.md) | 环境要求、开发服务器、脚本、测试与代码约定 |
| [HTTP API](./docs/zh-CN/http-api.md) | Express 路由、集合、`curl` 示例与安全边界 |
| [实时 API](./docs/zh-CN/realtime-api.md) | 供第三方 Overlay 使用的 Socket.IO 事件 |
| [Overlay 清单格式](./docs/zh-CN/overlay-format.md) | zip 导入规则、`overlay.json` 清单与生效设置 |
| [发布](./docs/zh-CN/release.md) | 构建链路、安装包内容与自动更新 |
| [常见问题](./docs/zh-CN/faq.md) | GSI、端口、Overlay 空白、zip 导入等排查 |

## 主要特性

### 赛事数据管理

创建赛事、队伍、玩家与比赛，并把即将直播的那场比赛设为 **Live**。Live 比赛会驱动 Overlay 上的队名、队标、比分与选手卡片。

### GSI 自动配置

初始化向导会通过 Steam 自动识别 CS2 安装路径，并把 `gamestate_integration_zhenhai.cfg` 安装到 `<CS2>/game/csgo/cfg/`，让游戏把数据发送到本地服务。

### Overlay 显示与自定义

颜色、圆角、安全区域与各组件是否显示都可以在设置面板中调整，无需改动 Overlay 代码。

### Overlay 管理

**Overlays** 页面会列出内置、已导入与开发三类 Overlay，可切换当前生效项、把 `.zip` 资源包导入到 `Documents/ZhenHai/overlays`、在文件管理器中定位文件，以及删除导入的 Overlay。

### 第三方 Overlay 清单

资源包可附带 `overlay.json`，声明自身信息、可编辑设置（`settings`）、强制生效的值（`override`）以及自定义全局快捷键。修改过的值按 Overlay 独立保存；强制覆盖只影响发给该 Overlay 的设置载荷，管理端自身的运行时设置不会被第三方清单改变。

### 全局快捷键

系统级快捷键让直播时无需切出游戏窗口：刷新 Overlay 与切换鼠标穿透。两者都可以在设置中改键，Overlay 也可以声明自己的快捷键。

### 界面多语言

管理端界面提供简体中文与英文，默认跟随系统，可在设置面板中切换。

### 自动更新

已安装版本通过 GitHub Releases 自动更新，并在设置面板中显示下载进度，之后提供重启安装的入口。

## 快速开始

1. 从 Release 页面下载并安装最新的 `Zhenhai-<version>-setup.exe`。
2. 运行应用并完成初始化向导：确认 CS2 安装目录、安装 GSI 配置、选择窗口材质。
3. 依次添加数据——玩家、队伍、比赛，然后把即将直播的比赛设置为 **Live**。
4. 启动 CS2。游戏开始发送 GSI 数据后，HUD 即可收到内容。
5. 在应用中打开 Overlay。窗口创建时默认开启鼠标穿透，需要先按穿透快捷键再点击窗口内部。
6. 在 OBS 或 vMix 中添加浏览器源，参考下列推荐参数。

浏览器源推荐参数：宽度 `1920`、高度 `1080`，地址使用 **工具箱 → Commands & Links** 中显示的 URL。

| 用途 | 地址 |
| --- | --- |
| 内置 Overlay | `http://127.0.0.1:1469/overlay/` |
| 内置 Overlay 的别名 | `http://127.0.0.1:1469/hud` |
| 已导入或额外内置 Overlay | `http://127.0.0.1:1469/overlays/<id>/` |
| Overlay 开发服务器（`bun run dev:hai`） | `http://localhost:1467/overlay/` |

## 快捷键

| 动作 | 默认按键 | 说明 |
| --- | --- | --- |
| 刷新 Overlay | `Ctrl + Alt + I` | 向所有已连接的 Overlay 广播 `overlay:refresh` |
| 切换鼠标穿透 | `Ctrl + Alt + M` | 切换 Overlay 窗口的 `ignoreMouseEvents` |
| Overlay 声明的快捷键 | 由 `overlay.json` 定义 | 仅在该 Overlay 被选中时注册 |

在设置面板中按下想用的组合键即可改键，注册冲突会在输入框下方提示。

## 第三方 Overlay

任何静态网页资源包都能作为 Overlay 导入：把 `index.html` 放在压缩包根目录（或唯一的包装文件夹中），然后在 **Overlays** 页面导入。压缩包会先经过校验，再解压到 `Documents/ZhenHai/overlays/<id>/` 并通过 `/overlays/<id>/` 对外提供；选中该 Overlay 时，已打开的 Overlay 窗口会立即重新加载。

Overlay 通过本地服务 `http://127.0.0.1:1469` 的 Socket.IO 或 REST 读取实时数据，因此不需要任何 Electron 集成。附加 `overlay.json` 可以声明自身信息、可编辑设置与快捷键，详见 [Overlay 清单格式](./docs/zh-CN/overlay-format.md) 与 [实时 API](./docs/zh-CN/realtime-api.md)。

## 技术架构

```text
Zhenhai-HUD-Manager/
├── apps/
│   ├── Zhen/        # Electron 应用：管理端界面、本地服务、Overlay 窗口
│   └── Hai/         # Overlay 前端（Vue 3）：构建到 apps/Hai/dist，由 pack 安装到 apps/Zhen/resources/overlay
├── packages/
│   └── csgogsi/     # 基于上游 csgogsi 6.0.1 的适配层
├── docs/            # 文档（zh-CN / en-US）
└── scripts/         # 仓库工具
```

| 层 | 技术栈 |
| --- | --- |
| 管理端界面 | Vue 3、Pinia、Nuxt UI、Tailwind CSS、Vue Router、vue-i18n |
| 主进程 | Electron、Express、Socket.IO、LowDB、electron-updater、electron-log |
| 比赛状态 | 由 `@zhenhai/csgogsi` 封装的 [`csgogsi`](https://github.com/osztenkurden/csgogsi) 6.0.1 |
| Overlay | Vue 3、Pinia、Tailwind CSS |

管理端进程承载了 Overlay 需要的全部能力：REST 接口、增强后比赛状态的 Socket.IO 数据流，以及 Overlay 资源包的静态托管。更多细节见 [架构](./docs/zh-CN/architecture.md)。

## 开发与构建

| 前置条件 | 版本 |
| --- | --- |
| Bun | `1.3.14` 或更新（由 `packageManager` 声明） |
| Node.js | `^22.18.0` 或 `>=24.12.0` |
| Windows | 10 / 11，用于打包与 Overlay 鼠标穿透 |

```bash
bun install
bun run dev        # 同时启动管理端与 Overlay 开发服务器
bun run typecheck  # 对整个工作区做类型检查
bun run build      # 先构建 Hai，再打包 Windows 版 Zhen
```

| 位置 | 脚本 |
| --- | --- |
| 根 | `dev`、`dev:zhen`、`dev:hai`、`build`、`typecheck`、`lint`、`format`、`clean`、`docs:check` |
| `apps/Zhen` | `dev`、`build`、`build:win`、`build:unpack`、`test`、`typecheck`、`pack:overlay` |
| `apps/Hai` | `dev`、`build`、`pack`、`preview`、`type-check` |

单元测试基于 `node --test`（`bun run --cwd apps/Zhen test`），安装包由 `bun run build` 生成。更多内容见 [开发](./docs/zh-CN/development.md) 与 [发布](./docs/zh-CN/release.md)。

## 安全说明

- 本地服务（Express + Socket.IO）默认只监听 `127.0.0.1`，同网段设备无法访问。
- 在设置中开启 **Allow LAN access** 后，服务改为监听 `0.0.0.0`；此时同网段设备可以读写**全部集合**，包括应用设置（局域网开关、快捷键、当前 Overlay）与 Overlay 列表。请仅在可信网络中开启。
- 导入的第三方 Overlay 以本地网页运行，并且**拥有完整应用权限**（可读写数据库、写文件、安装 GSI 配置、触发更新器）。请只导入可信来源；如后续需要收紧，可移除 Overlay 窗口的 preload。
- zip 导入仅校验压缩包头部的条目数与体积，不校验解压后的真实体积，请勿导入来源不明的压缩包。

完整的暴露面说明见 [HTTP API](./docs/zh-CN/http-api.md)。

## 致谢

感谢以下项目与社区的支持：

- [cshuds.com](https://cshuds.com)
- [JTsHM / OpenHUD](https://github.com/JohnTimmermann/OpenHud)
- [drweissbrot / cs-hud](https://github.com/drweissbrot/cs-hud)

以及所有为该项目提供帮助和支持的人们。
