# Overlay 清单格式

[English](../en-US/overlay-format.md) · [返回 README](../../README_ZH.md)

任何静态网页资源包都可以作为 Overlay 使用：一个包含 `index.html` 的 zip 就足够了。如果再附带 `overlay.json`，就能声明自身信息、可编辑设置、强制覆盖值以及自定义全局快捷键。

## 导入 zip

1. 打开 **Overlays** 页面，选择 **Import Overlay (.zip)**。
2. 管理端会把压缩包解压到系统临时目录，校验每个条目后再移动到 `%USERPROFILE%\Documents\ZhenHai\overlays\<id>\`。
3. 该 Overlay 会写入 `overlays` 集合、成为当前选中项，并立即通过 `/overlays/<id>/` 对外提供。

Overlay id 由 zip 文件名派生（小写字母、数字与连字符；重名会自动追加数字后缀）。

### 校验规则

| 规则 | 限制 |
| --- | --- |
| 条目数量 | 最多 `5000` 个 |
| 单个条目 | 解压后最多 `256 MB` |
| 解压总大小 | 最多 `512 MB` |
| 条目路径长度 | 最多 `240` 个字符 |
| 路径 | 不允许绝对路径、盘符、`..` 片段与 NUL 字节 |
| 链接 | 拒绝符号链接 |
| 入口文件 | 根目录必须存在 `index.html`，或位于压缩包唯一的顶层文件夹内 |

体积按 zip 头部声明读取，解压后不会重新测量，因此请不要导入来源不明的压缩包。

## `overlay.json` 清单

清单会在应用启动时以及打开该 Overlay 设置弹窗时从磁盘重新读取。`overlay.json`（新标准）与 `zhenhai.overlay.json`（兼容旧包）都会被识别，且前者优先。

```json
{
  "manifestVersion": 1,
  "name": "我的直播 HUD",
  "description": "侧边栏、比分板与回合提示",
  "version": "1.4.0",
  "author": "your-name",
  "homepage": "https://example.com/my-hud",
  "settings": {
    "somePlaceBorderRadius": 12,
    "showRadar": true,
    "accentColor": "#ff5c5c"
  },
  "override": {
    "extras": {
      "playerBoxOpacity": 1
    }
  },
  "shortcuts": [
    {
      "id": "toggle-scoreboard",
      "name": "切换比分板",
      "default": "CommandOrControl+Alt+S",
      "description": "比分板可见时触发"
    }
  ]
}
```

| 字段 | 含义 |
| --- | --- |
| `manifestVersion` | 清单结构版本，当前为 `1` |
| `name`、`description`、`version`、`author`、`homepage` | 在 Overlay 列表与设置弹窗中展示的信息 |
| `settings` | 可编辑默认值，用户可在应用内逐项修改 |
| `override` | 该 Overlay 的强制值，始终生效且用户不可编辑 |
| `shortcuts` | 该 Overlay 被选中时注册的全局快捷键 |

### 清单限制

| 规则 | 限制 |
| --- | --- |
| 清单文件体积 | 最多 `64 KB` |
| `settings` / `override` 键数量 | 各最多 `64` 个 |
| 键名 | `^[A-Za-z][A-Za-z0-9_.-]*$` |
| `shortcuts` | 最多 `16` 条 |
| 快捷键 id | `^[a-z][a-z0-9-]*$`，清单内不可重复 |
| 快捷键组合 | 必须包含修饰键（`Ctrl`/`Alt`/`Shift`/`Super`），清单内不可重复 |

超出限制或结构非法的内容会被丢弃并以警告形式提示，而不会让整个导入失败。

## 生效设置

发给 Overlay 的设置按以下顺序合成（后者覆盖前者）：

1. 应用设置（设置面板）。
2. 清单的 `settings` 默认值。
3. 用户在 Overlay 设置弹窗中修改的值。
4. 清单的 `override` 强制值。

`extras` 按键级合并，而不是整体替换。GSI 载荷里的 `data.settings` 与 `GET /api/settings` 使用同一份合成结果，两处输出始终一致。

强制覆盖只影响发给 Overlay 的设置载荷。应用自身的运行时键——局域网开关、应用快捷键、窗口材质、CS2 路径、当前选中 Overlay、首次启动标记——永远不会被第三方清单改变。

## 快捷键

清单声明的快捷键会在该 Overlay 被选中时注册为全局快捷键，切走后自动注销。按下时会通过 Socket.IO 广播 `overlay:shortcut`（见 [实时 API](./realtime-api.md)），并通过 IPC 通知内置 Overlay 窗口。与应用快捷键冲突时应用优先，冲突的 Overlay 快捷键会在设置弹窗中提示。

## 制作检查清单

- 使用**相对 base** 构建（Vite 中为 `base: "./"`），并优先使用 hash 路由。请求 `/assets/index.js` 这类绝对路径的资源包在 `/overlays/<id>/` 下会 404。
- `index.html` 放在压缩包根目录，或整体包在唯一的顶层文件夹中。
- 实时数据从 `http://127.0.0.1:1469`（Socket.IO）读取，不要假设页面已被注入数据。
- 新资源包请使用 `overlay.json`，而不是 `zhenhai.overlay.json`。
- 发布前同时用 zip 导入与开发服务器条目（URL + 路由）各测一遍。

## 排查

| 现象 | 原因 / 处理 |
| --- | --- |
| 页面空白，控制台报 `/assets/...` 404 | 资源包以绝对 base 构建；改用 `base: "./"` 重新构建 |
| `Unknown overlay: <id>` | 该 id 未注册——重新导入，或检查文件夹名 |
| 资源加载正常但没有数据 | 未连上 `http://127.0.0.1:1469`，或 CS2 尚未发送 GSI 数据 |
| 导入时提示绝对路径资源告警 | `index.html` 引用了 `/…` 路径，参见第一行 |
