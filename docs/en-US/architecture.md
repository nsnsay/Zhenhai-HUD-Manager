# Architecture

[简体中文](../zh-CN/architecture.md) · [Back to README](../../README.md)

ZhenHai HUD Manager is an Electron desktop application that owns the data, a local Express + Socket.IO server that distributes live game state, and a separate Vue front-end that renders the on-air HUD.

## Repository Layout

```text
Zhenhai-HUD-Manager/
├── apps/
│   ├── Zhen/                     # Electron app: manager UI + local server + overlay window
│   │   ├── src/main/             # Main process (Express, Socket.IO, LowDB, GSI, shortcuts, updater)
│   │   ├── src/preload/          # contextBridge API exposed as window.api
│   │   ├── src/renderer/         # Vue 3 manager UI (routes, stores, components)
│   │   ├── src/shared/           # Types + pure helpers shared by main / preload / renderer
│   │   ├── resources/            # GSI config, built overlay, extra built-in overlays
│   │   └── electron-builder.yml  # Packaging, NSIS artifact and update publish config
│   └── Hai/                      # Overlay front-end (Vue 3); builds into apps/Zhen/resources/overlay
├── packages/
│   └── csgogsi/                  # Adapter on top of upstream csgogsi 6.0.1
├── docs/                         # Documentation (zh-CN / en-US mirrors)
└── scripts/                      # Repository tooling (docs:check)
```

## Processes

| Layer | Location | Responsibility |
| --- | --- | --- |
| Main | `apps/Zhen/src/main` | HTTP + Socket.IO server, LowDB collections, GSI parsing and enrichment, overlay window lifecycle, global shortcuts, auto updater, logging |
| Preload | `apps/Zhen/src/preload` | `contextBridge` surface (`window.api`) for the manager UI and for the overlay window |
| Renderer (manager) | `apps/Zhen/src/renderer` | Vue 3 + Pinia + Nuxt UI management interface (database, toolbox, overlay management, settings) |
| Renderer (overlay) | `apps/Hai` | The broadcast HUD; production build is copied to `apps/Zhen/resources/overlay` |
| Adapter package | `packages/csgogsi` | Re-exports `csgogsi` 6.0.1, adds ZhenHai business types and a Vue GSI store |
| Shared | `apps/Zhen/src/shared` | Types, constants and pure functions shared by main, preload, renderer and unit tests |

## Data Flow

1. CS2 posts the GSI payload to `http://localhost:1469/gsi` (configured by `gamestate_integration_zhenhai.cfg`).
2. `GsiService` hands the payload to the csgogsi parser.
3. Before any gameplay event is emitted, `ZhenHaiGSI` (a local subclass of the upstream `CSGOGSI`) runs the enrichment pipeline over `this.current`, so event payloads already carry enriched players, teams and bomb data.
4. Middleware merges database information: `_db` on players and teams, weapon/armor/bomb helper fields, `map.regularMR` / `map.overtimeMR`, and the effective `data.settings`.
5. `GsiService` re-emits `gsi:data` and `gsi:<event>`; the Socket.IO service forwards them to connected clients — and only while at least one client is connected.
6. Overlay pages (built-in, imported or a development URL) subscribe to Socket.IO and render the HUD.

## Local Server

The Express server listens on port `1469`, bound to `127.0.0.1` by default. Route groups: GSI ingest (`/gsi`), logging (`/logger`), REST (`/api/*`), uploaded assets (`/assets`) and overlay static hosting (`/overlay`, `/hud`, `/overlays/<id>`).

See [HTTP API](./http-api.md) for the full route table and [Realtime API](./realtime-api.md) for the Socket.IO contract.

## Storage Layout

Application data lives in `%USERPROFILE%\Documents\ZhenHai\`:

| Path | Contents |
| --- | --- |
| `players.json`, `teams.json`, `matchs.json`, `tournaments.json`, `extras.json`, `overlays.json` | One LowDB file per collection; `extras` also stores the app settings record |
| `assets/` | Images uploaded from the manager (player photos, team logos), grouped by category |
| `overlays/<id>/` | Unpacked third-party overlays imported from a zip |
| `logs/` | Rolling application logs |

## Overlay Loading

| Source | Location on disk | Public path |
| --- | --- | --- |
| Built-in default | `apps/Zhen/resources/overlay` | `/overlay/` (alias `/hud`) |
| Extra built-in | `apps/Zhen/resources/overlays/<id>` | `/overlays/<id>/` |
| Imported | `<Documents>/ZhenHai/overlays/<id>` | `/overlays/<id>/` |
| Development | Any `http(s)` URL, unpackaged builds only | The URL plus optional route |

The built-in default overlay is built by `apps/Hai` with Vite `base: "/overlay/"`, so it stays on `/overlay/`. Requests to `/overlays/default/*` are answered with a 302 redirect to `/overlay/*` instead of being served from a second path.

## Enrichment Details

| Pipeline | Effect |
| --- | --- |
| `player.pipeline.ts` | Matches players to database records by SteamID into `_db`, sets `isFocused` / `isDead` / armor / bomb flags, splits weapons into `primaryweapon`, `secondaryweapon`, `knifeweapon`, `activeweapon` and `grenades`, and normalizes observer slots |
| `team.pipeline.ts` | Attaches the team record and roster into `_db`, resolves team logos and scores from the live match |
| `match.pipeline.ts` | Resolves the live match metadata (teams, scores, map information) |
| `settings.pipeline.ts` | Injects the effective settings (see [overlay format](./overlay-format.md)) into `data.settings` |
| `observer-slot.ts` | Maps CS2 observer slots to HUD slots: `1..9` become `slot + 1`, `10` becomes `0`, `0` and `11+` stay unchanged |

## History

The project started as two repositories (`Void-HUD-Manager` and `Void-HUD-Overlay`) and was rebuilt as the single Turborepo workspace `ZhenHai-HUD-Manager`: the manager, the overlay front-end and the GSI adapter now live side by side under `apps/` and `packages/`.
