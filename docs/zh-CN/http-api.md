# HTTP API

[English](../en-US/http-api.md) · [返回 README](../../README_ZH.md)

管理端进程在 `1469` 端口运行 Express 服务，负责提供 Overlay 静态资源、接收 GSI 数据，并以 REST 形式暴露数据库。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/gsi` | `gamestate_integration_zhenhai.cfg` 指向的 GSI 入口；立即返回 `200`，随后异步处理数据 |
| `POST` | `/logger` | 供 Overlay 页面写入日志（`{ level, source, message, meta? }`） |
| `GET` | `/api/settings` | 当前选中 Overlay 的生效设置（应用设置与 Overlay 清单合成后的结果） |
| `GET` | `/api/:collection` | 列出记录，支持 `where`、`orderBy`、`order`、`limit`、`offset` |
| `GET` | `/api/:collection/:id` | 读取单条记录 |
| `POST` | `/api/:collection` | 新建记录（`id`、`createdAt`、`updatedAt` 由服务端生成） |
| `PUT` | `/api/:collection/:id` | 更新记录 |
| `DELETE` | `/api/:collection/:id` | 删除记录 |
| `GET` | `/overlays/<id>/*` | 已导入或额外内置 Overlay 的静态资源（未注册的 id 返回 `404`） |
| `GET` | `/overlay/*`、`/hud/*` | 内置默认 Overlay 的静态资源 |
| `GET` | `/assets/*` | 管理端上传的图片 |

## 集合

`extras`、`players`、`teams`、`matchs`、`tournaments`、`overlays`。

`matchs` 沿用历史拼写。未知集合返回 `400`，响应体为 `{ "success": false, "error": "Unknown collection: …" }`。

每个集合对应 `%USERPROFILE%\Documents\ZhenHai\` 下的一个 LowDB 文件。`extras` 集合中同时保存应用设置记录（`configType: "app-settings"`），这也是 `/api/settings` 必须注册在通用 `/api/:collection` 之前的原因。

## 响应结构

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 0 }
}
```

- `POST` 成功返回 `201`，`PUT` 与 `DELETE` 返回 `200`，记录不存在返回 `404`。
- 尚无设置记录时，`GET /api/settings` 返回 `{ "success": true, "data": null }`。

## 请求示例

```bash
# 全部玩家
curl http://127.0.0.1:1469/api/players

# 仅 Live 比赛，按更新时间倒序
curl "http://127.0.0.1:1469/api/matchs?where=%7B%22isLive%22%3Atrue%7D&orderBy=updatedAt&order=desc"

# 队伍分页
curl "http://127.0.0.1:1469/api/teams?limit=10&offset=0"

# Overlay 实际收到的生效设置
curl http://127.0.0.1:1469/api/settings

# 新建一条记录
curl -X POST http://127.0.0.1:1469/api/players \
  -H "Content-Type: application/json" \
  -d '{"playerName":"s1mple","playerSteamID":"76561198000000000"}'
```

## 监听地址与安全边界

- 服务默认只绑定 `127.0.0.1`，同网段设备无法访问。
- 在设置中开启 **Allow LAN access** 后会重新绑定到 `0.0.0.0`；若新地址绑定失败，会自动恢复原来的监听地址。
- 服务没有鉴权，也没有 TLS：任何能访问该端口的客户端都可以读写**全部集合**，包括应用设置记录（局域网开关、快捷键、当前 Overlay）与 Overlay 注册表。
- CORS 为开放策略（`Access-Control-Allow-Origin: *`），因此来自其它源的 Overlay 页面也能订阅并读取数据。
- 导入的 Overlay 虽然是普通本地页面，但保留了完整的 preload 接口（可读写数据库、写文件、安装 GSI 配置、触发更新器），因此只应导入可信来源。
