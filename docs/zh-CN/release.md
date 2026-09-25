# 发布

[English](../en-US/release.md) · [返回 README](../../README_ZH.md)

工作区如何产出 Windows 安装包、安装包里包含什么，以及已安装客户端如何自动更新。

## 构建链路

```bash
bun run build        # apps/Hai build -> apps/Zhen build:win
```

| 步骤 | 命令 | 产物 |
| --- | --- | --- |
| 1 | `bun run --cwd apps/Hai build` | Overlay 构建输出到 `apps/Hai/dist`（类型检查 + Vite 构建） |
| 2 | `bun run --cwd apps/Zhen version:patch` | 递增 `apps/Zhen/package.json` 的补丁版本号（属于 `build:win` 的一环） |
| 3 | `bun run --cwd apps/Zhen build` | `typecheck` → `electron-vite build` → `pack:overlay` |
| 4 | `electron-builder --win` | 在 `apps/Zhen/dist` 生成 NSIS 安装包（electron-builder 的输出目录；`--dir` 输出到 `apps/Zhen/dist/win-unpacked`） |

`pack:overlay` 按 Overlay 项目 `package.json` 里的 `zhenhaiOverlay` 元数据打包：缺少 `apps/Hai/dist` 时自动先构建，校验入口与清单，把 `name`/`description`/`author`/`version`（内置 Overlay 的版本号取自 `apps/Zhen/package.json`）写入清单，将产物安装到 `resources/overlay`，再输出到仓库根目录的 `dist/zhenhai-default-<version>.zip` 并删除同前缀的历史压缩包。该 zip 是内置 Overlay 的再分发包，可通过 Overlays 页面重新导入；`dist/` 目录被 git 忽略，且 `electron-builder` 从不引用它，因此资源包压缩件不会被放进安装包。

## 安装包内容

打包配置位于 `apps/Zhen/electron-builder.yml`：

| 配置 | 值 |
| --- | --- |
| 应用 id | `com.zhenhai.zhen` |
| 产品名 | `ZhenHaiHM` |
| Windows 可执行文件 | `zhen` |
| 安装包产物 | `Zhenhai-<version>-setup.exe`（NSIS，桌面快捷方式名为 `ZhenHai`） |
| extraResources | `resources/overlay` → `overlay`、`resources/overlays` → `overlays`、`resources/gamestate_integration_zhenhai.cfg` → `gamestate_integration_zhenhai.cfg` |
| asar 解包 | `resources/**`，保证 GSI 配置与 Overlay 文件在磁盘上可直接读取 |
| 更新源 | GitHub，`nsnsay/ZhenHai-HUD-Manager` |
| Electron 下载镜像 | `https://npmmirror.com/mirrors/electron/` |

由于 `resources/overlay` 与 GSI 配置放在 `extraResources` 中，安装后的目录结构会把它们保留在 asar 之外，同时仍然随应用一起分发。

## 自动更新

已安装版本通过 `electron-updater` 检查更新，并通过 `updater:event` IPC 通道上报进度，类型包括 `checking`、`available`、`not-available`、`downloading`、`downloaded`、`error`。`downloading` 会带上 `percent` 字段，设置面板据此渲染下载进度条；`downloaded` 之后即可执行安装（`updater:install`）。

未打包的开发构建不会自我更新；要端到端验证更新流程，请使用打包后的安装版本。

## 发布检查清单

1. 确认工作区干净且单元测试通过（`bun run --cwd apps/Zhen test`）。
2. 在 Windows 上执行 `bun run build` 生成安装包（版本号会自动递增）。
3. 验证安装包：GSI 配置能安装、Overlay 能在 `/overlay/` 打开、`dist/zhenhai-default-<version>.zip` 可导入、原有 Overlay 仍在列表中。
4. 为该 tag 创建 GitHub Release 并附上 `Zhenhai-<version>-setup.exe`；发布配置与本仓库匹配，`electron-builder` 也可以直接上传。
5. 已安装客户端会通过更新器获取该版本，先显示下载进度条，再提供重启安装的入口。
