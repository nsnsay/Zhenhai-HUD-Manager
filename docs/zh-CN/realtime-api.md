# 实时 API

[English](../en-US/realtime-api.md) · [返回 README](../../README_ZH.md)

实时比赛状态通过 Socket.IO 分发，与 HTTP API 共用同一个端口（`http://127.0.0.1:1469`）。第三方 Overlay 无需任何 Electron 集成即可获取数据。

## 建立连接

```html
<script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>
<script>
  const socket = io("http://127.0.0.1:1469");

  socket.on("connect", () => console.log("connected"));
  socket.on("gsi:data", (data) => render(data));
  socket.on("gsi:roundEnd", (round) => console.log("round over", round));
  socket.on("overlay:refresh", () => location.reload());
});
</script>
```

任意 Socket.IO 4.x 客户端都可用（浏览器打包版、npm 的 `socket.io-client` 或非 JavaScript 客户端）。CORS 为开放策略，只要能访问到直播机的地址，托管在别处的 Overlay 页面同样可以连上 `http://127.0.0.1:1469`。

## 事件

| 事件 | 载荷 | 触发时机 |
| --- | --- | --- |
| `gsi:data` | 增强后的 `GameState`（`map`、`round`、`players`、`bomb`、`settings` 等） | 每收到一包 GSI 数据 |
| `gsi:<event>` | 对应事件的载荷 | 相应比赛事件触发时 |
| `overlay:refresh` | `{ timestamp }` | 按下刷新快捷键时；Overlay 通常会据此重新加载页面 |
| `overlay:shortcut` | `{ overlayId, shortcutId, timestamp }` | 按下当前选中 Overlay 清单声明的快捷键时 |

转发的比赛事件（`gsi:<event>`）：

`roundStart`、`observerTargetChange`、`roundEnd`、`mapEnd`、`matchEnd`（为兼容保留的已废弃别名）、`overtime`、`kill`、`hurt`、`phaseChange`、`timeoutStart`、`timeoutEnd`、`pauseStart`、`pauseEnd`、`warmupStart`、`warmupEnd`、`mvp`、`freezetimeStart`、`freezetimeEnd`、`intermissionStart`、`intermissionEnd`、`defuseStart`、`defuseStop`、`bombPlantStart`、`bombPlantStop`、`bombPlant`、`bombExplode`、`bombDefuse`。

## 行为说明

- **只有存在客户端连接时才会派发事件**：主进程在第一个客户端连接时挂载 GSI 监听，最后一个客户端断开时卸载，从而在没有观众时省掉整条增强管线的开销。
- 没有历史回放：客户端连接后收到的是之后的数据包，因此首次有效渲染发生在 CS2 再次发送数据时。
- 载荷与内置 Overlay 完全一致，包含 `_db`、武器派生字段、`map.regularMR` / `map.overtimeMR` 以及生效中的 `settings`。
- 需要请求/响应式访问时请改用 [HTTP API](./http-api.md)。

## 快捷键消息

Overlay 清单可以声明全局快捷键。当选中该 Overlay 并按下快捷键时，会在此通道广播 `overlay:shortcut`，并通过 IPC 把同样的载荷推送给内置 Overlay 窗口：

```json
{ "overlayId": "my-overlay", "shortcutId": "toggle-scoreboard", "timestamp": 1737000000000 }
```

`overlayId` 标明该快捷键来自哪个清单，页面可据此忽略发给其它资源包的消息。
