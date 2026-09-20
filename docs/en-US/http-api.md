# HTTP API

[简体中文](../zh-CN/http-api.md) · [Back to README](../../README.md)

The manager process hosts an Express server on port `1469` that serves overlay assets, accepts GSI payloads and exposes the database over REST.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/gsi` | GSI ingest endpoint targeted by `gamestate_integration_zhenhai.cfg`; responds `200` immediately and processes the payload asynchronously |
| `POST` | `/logger` | Writes a log entry from an overlay page (`{ level, source, message, meta? }`) |
| `GET` | `/api/settings` | Effective settings for the currently selected overlay (app settings merged with the overlay manifest) |
| `GET` | `/api/:collection` | List records; supports `where`, `orderBy`, `order`, `limit`, `offset` |
| `GET` | `/api/:collection/:id` | Read a single record |
| `POST` | `/api/:collection` | Create a record (server assigns `id`, `createdAt`, `updatedAt`) |
| `PUT` | `/api/:collection/:id` | Update a record |
| `DELETE` | `/api/:collection/:id` | Delete a record |
| `GET` | `/overlays/<id>/*` | Static files of an imported or extra built-in overlay (unknown ids return `404`) |
| `GET` | `/overlay/*`, `/hud/*` | Static files of the built-in default overlay |
| `GET` | `/assets/*` | Images uploaded from the manager |

## Collections

`extras`, `players`, `teams`, `matchs`, `tournaments`, `overlays`.

`matchs` keeps its historical spelling. An unknown collection returns `400` with `{ "success": false, "error": "Unknown collection: …" }`.

Each collection is stored as a LowDB file in `%USERPROFILE%\Documents\ZhenHai\`. The `extras` collection also holds the application settings record (`configType: "app-settings"`), which is why `/api/settings` is registered before the generic `/api/:collection` route.

## Response Shape

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 0 }
}
```

- `POST` returns `201` on success, `PUT` and `DELETE` return `200`, and a missing record returns `404`.
- `GET /api/settings` returns `{ "success": true, "data": null }` when no settings record exists yet.

## Query Examples

```bash
# every player
curl http://127.0.0.1:1469/api/players

# live match only, newest first
curl "http://127.0.0.1:1469/api/matchs?where=%7B%22isLive%22%3Atrue%7D&orderBy=updatedAt&order=desc"

# one page of teams
curl "http://127.0.0.1:1469/api/teams?limit=10&offset=0"

# effective settings the overlay receives
curl http://127.0.0.1:1469/api/settings

# create a record
curl -X POST http://127.0.0.1:1469/api/players \
  -H "Content-Type: application/json" \
  -d '{"playerName":"s1mple","playerSteamID":"76561198000000000"}'
```

## Listening Address and Security Boundary

- The server binds to `127.0.0.1` by default, so other machines cannot reach it.
- Enabling **Allow LAN access** in Settings rebinds to `0.0.0.0`; if the new binding fails, the previous binding is restored.
- There is no authentication and no TLS: any client that can reach the port can read and write **every** collection, including the app settings record (LAN access, shortcuts, selected overlay) and the overlay registry.
- CORS is open (`Access-Control-Allow-Origin: *`) so overlay pages served from other origins can subscribe and read data.
- Imported overlays are ordinary local pages but keep the full preload API (database access, file writes, GSI install, updater), so only trusted bundles should be imported.
