# Realtime API

[简体中文](../zh-CN/realtime-api.md) · [Back to README](../../README.md)

Live game state is distributed over Socket.IO on the same port as the HTTP API (`http://127.0.0.1:1469`), which is how third-party overlays receive data without any Electron integration.

## Connecting

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

Any Socket.IO 4.x client works (browser bundle, `socket.io-client` from npm, or a non-JavaScript client). CORS is open, so an overlay hosted elsewhere can connect to `http://127.0.0.1:1469` as long as the broadcaster machine is reachable.

## Events

| Event | Payload | When |
| --- | --- | --- |
| `gsi:data` | The enriched `GameState` (`map`, `round`, `players`, `bomb`, `settings`, …) | On every GSI payload |
| `gsi:<event>` | Event-specific payload | When the corresponding gameplay event fires |
| `overlay:refresh` | `{ timestamp }` | The refresh shortcut is pressed; overlays usually reload the page |
| `overlay:shortcut` | `{ overlayId, shortcutId, timestamp }` | A shortcut declared by the selected overlay's manifest is pressed |

Forwarded gameplay events (`gsi:<event>`):

`roundStart`, `observerTargetChange`, `roundEnd`, `mapEnd`, `matchEnd` (deprecated alias kept for compatibility), `overtime`, `kill`, `hurt`, `phaseChange`, `timeoutStart`, `timeoutEnd`, `pauseStart`, `pauseEnd`, `warmupStart`, `warmupEnd`, `mvp`, `freezetimeStart`, `freezetimeEnd`, `intermissionStart`, `intermissionEnd`, `defuseStart`, `defuseStop`, `bombPlantStart`, `bombPlantStop`, `bombPlant`, `bombExplode`, `bombDefuse`.

## Behaviour Notes

- Events are emitted **only while at least one client is connected**; the main process attaches its GSI listeners on the first connection and detaches them on the last disconnect. This keeps the enrichment pipeline idle when nobody is watching.
- There is no replay: a client receives the next payload after connecting, so the first meaningful render happens when CS2 sends data.
- The payload is the same enriched object the built-in overlay consumes — including `_db`, weapon helpers, `map.regularMR` / `map.overtimeMR` and the effective `settings`.
- For request/response style access use the [HTTP API](./http-api.md) instead.

## Shortcut Messages

Overlay manifests can declare global shortcuts. When the selected overlay declares them, pressing one broadcasts `overlay:shortcut` on this channel and pushes the same payload over IPC to the built-in overlay window:

```json
{ "overlayId": "my-overlay", "shortcutId": "toggle-scoreboard", "timestamp": 1737000000000 }
```

The `overlayId` identifies which manifest the shortcut came from, so a page can ignore messages addressed to another bundle.
