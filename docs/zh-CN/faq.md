# 常见问题与故障排查

[English](../en-US/faq.md) · [返回 README](../../README_ZH.md)

这里汇总使用 ZhenHai HUD Manager 过程中的常见问题，以及通常能定位原因的检查步骤。

## GSI 配置安装失败

向导会把 `gamestate_integration_zhenhai.cfg` 复制到 `<CS2>/game/csgo/cfg/`。如果提示源文件缺失或复制失败：

1. 在设置中确认 CS2 安装路径（可通过 Steam 自动识别，也可手动选择）。
2. 手动安装：把应用 `resources` 目录下的 `gamestate_integration_zhenhai.cfg` 复制到 `<Steam>\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\`。
3. 重启 CS2 让它加载该文件，然后确认 HUD 能收到数据。

配置文件第一行仍保留旧名称 `Void HUD`，这是历史遗留且不影响功能。

该文件把 CS2 指向 `http://localhost:1469/gsi`，因此必须保持管理端运行才能收到数据。

## 端口 1469 被占用

本地服务（HTTP + Socket.IO）需要 `1469` 端口。请关闭另一个实例或占用该端口的程序后重启应用。若端口一直被占用，日志会记录失败原因，Overlay 也无法订阅实时数据。

## Overlay 窗口或浏览器源空白

| 检查项 | 说明 |
| --- | --- |
| 地址 | 内置 Overlay 为 `http://127.0.0.1:1469/overlay/`；导入的为 `http://127.0.0.1:1469/overlays/<id>/` |
| 当前选中项 | Overlays 页面会显示生效中的 Overlay；切换时已打开的 Overlay 窗口会自动重新加载 |
| `/overlay/s/...` 返回 404 | 资源包使用了绝对 base 或 history 路由，请求到了错误的子路径——改用 `base: "./"` 与 hash 路由重新构建 |
| 没有数据 | 房间尚未发送 GSI 数据、GSI 配置未安装，或当前没有客户端连接（零连接时不会派发事件） |

在 OBS 或 vMix 中新建 `1920 × 1080` 的浏览器源，地址使用 **工具箱 → Commands & Links** 中显示的 URL。

## 其它机器访问不到 Overlay

默认情况下服务只监听 `127.0.0.1`。在设置中开启 **Allow LAN access** 后会重新绑定到 `0.0.0.0`，此时可用直播机的局域网地址（`http://<主机 IP>:1469/overlay/`）访问。请注意这会向整个网络暴露无鉴权的 REST 接口，仅建议在可信网络中使用。

## zip 导入失败

| 提示 | 含义 |
| --- | --- |
| `zip_no_index_html` | 压缩包中没有 `index.html`，或目录层级比「唯一顶层文件夹」更深 |
| `zip_unsafe_entry` | 存在绝对路径、盘符或 `..` 形式的条目 |
| `zip_symlink` | 压缩包中包含符号链接 |
| `zip_too_many_entries` / `zip_too_large` | 条目数量或声明的体积超过文档给出的上限 |
| 绝对路径资源告警 | `index.html` 引用了 `/…` 路径；Overlay 可能仍能加载，但在 `/overlays/<id>/` 下资源会 404 |

请把 `index.html` 放在压缩包根目录（或唯一的包装文件夹中），并尽量使用相对资源路径。

## 鼠标穿透快捷键没有反应

- 穿透开关作用于**当前已打开**的 Overlay 窗口；快捷键不会自动创建窗口。
- 默认按键为 `Ctrl + Alt + M`，可能已被其它程序占用——可在设置中改键，注册失败会在输入框下方提示。
- 每次创建 Overlay 窗口都从**开启穿透**开始，因此需要先关掉穿透才能点击 HUD。

## 改键时组合键被拒绝

快捷键必须包含 `Ctrl`、`Alt` 或 `Super`，并以字母、数字、功能键或受支持的具名键结尾。若组合键已被其它程序占用，注册会失败，输入框会显示原因，原绑定保持不变。

## 数据与日志在哪里

全部位于 `%USERPROFILE%\Documents\ZhenHai\`：各集合以 JSON 文件保存，上传的图片在 `assets/`，导入的 Overlay 在 `overlays/`，滚动日志在 `logs/`。整体拷贝该目录即可把环境迁移到另一台机器。
