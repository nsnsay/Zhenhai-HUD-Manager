# Zhen-Hai HUD Manager

![Platform](https://img.shields.io/badge/platform-Windows%20x64-informational)
![Bun](https://img.shields.io/badge/bun-1.3.14-black)
![Vue](https://img.shields.io/badge/vue-3-42b883)
[![Downloads](https://img.shields.io/github/downloads/nsnsay/Zhenhai-HUD-Manager/total)](https://github.com/nsnsay/Zhenhai-HUD-Manager/releases)

[English](./README.md) | [简体中文](./README_ZH.md)

> Previously known as **Void HUD Manager**, the project has been fully rebuilt and officially renamed to **Zhen-Hai HUD Manager**.
> The name "Zhenhai" (Chinese: 镇海) is inspired by the Zhan'ao Pagoda in Haining, Zhejiang, China.

## Introduction

Zhen-Hai HUD Manager is a HUD management tool for Counter-Strike esports broadcasts. It manages tournaments, teams, players and matches, enriches the live game state coming from CS2, and serves the on-air HUD to OBS or vMix.

Compared with the legacy Void HUD Manager, this rebuild changes the architecture, the interface and the operating flow: the former two-repository setup (`Void-HUD-Manager` + `Void-HUD-Overlay`) became a single Turborepo workspace, the code base was reorganised for maintainability, and the tournament, team, player and match workflows were redesigned.

## Documentation

| Document | Contents |
| --- | --- |
| [Architecture](./docs/en-US/architecture.md) | Processes, data flow, storage layout, overlay loading |
| [Development](./docs/en-US/development.md) | Requirements, dev servers, scripts, tests, conventions |
| [HTTP API](./docs/en-US/http-api.md) | Express routes, collections, `curl` examples, security boundary |
| [Realtime API](./docs/en-US/realtime-api.md) | Socket.IO events for third-party overlays |
| [Overlay format](./docs/en-US/overlay-format.md) | Zip import rules, the `overlay.json` manifest, effective settings |
| [Release](./docs/en-US/release.md) | Build pipeline, installer contents, auto update |
| [FAQ](./docs/en-US/faq.md) | Troubleshooting GSI, ports, blank overlays, zip imports |

## Key Features

### Match Data Management

Create tournaments, teams, players and matches, then mark one match as **Live**. The live match drives team names, logos, scores and player cards on the overlay.

### Automatic GSI Setup

The Setup Wizard detects the CS2 installation through Steam and installs `gamestate_integration_zhenhai.cfg` into `<CS2>/game/csgo/cfg/`, pointing the game at the local server.

### Overlay & HUD Customization

Colors, corner radius, safe area and per-component visibility are configured from the Settings panel — no overlay code needs to be touched.

### Overlay Management

The **Overlays** page lists built-in, imported and development overlays, switches the active one, imports a `.zip` bundle into `Documents/ZhenHai/overlays`, reveals files in the file manager and deletes them again.

### Third-Party Overlay Manifest

A bundle can ship an `overlay.json` declaring its metadata, editable settings (`settings`), values that always win (`override`) and its own global shortcuts. Edited values are stored per overlay, and overrides only affect the payload sent to that overlay — the manager's own runtime settings are never changed by a third-party manifest.

### Global Shortcuts

System-wide shortcuts remove the need to alt-tab while broadcasting: refresh the overlay and toggle mouse passthrough. Both are rebindable in Settings, and overlays may declare additional shortcuts of their own.

### Localization

The manager interface ships in Simplified Chinese and English, defaults to the system language and can be switched in Settings.

### Automatic Updates

Packaged builds update themselves through GitHub Releases and show download progress in Settings before offering the restart action.

## Quick Start

1. **Download and install** the latest `Zhenhai-<version>-setup.exe` from the Releases page.
2. **Run the app** and finish the Setup Wizard: confirm the CS2 installation folder, install the GSI configuration and pick a window material.
3. **Add your data** in order — players, teams, matches — then set the match you are about to broadcast to **Live**.
4. **Start CS2.** The HUD starts receiving data as soon as the game sends GSI updates.
5. **Open the overlay** from the application. The window starts in mouse-passthrough mode, so use the passthrough shortcut before clicking inside it.
6. **Add a browser source** in OBS or vMix with the recommended settings.

Recommended browser source settings: width `1920`, height `1080`, URL from **Toolbox → Commands & Links**.

| Purpose | URL |
| --- | --- |
| Built-in overlay | `http://127.0.0.1:1469/overlay/` |
| Alias of the built-in overlay | `http://127.0.0.1:1469/hud` |
| Imported or extra built-in overlay | `http://127.0.0.1:1469/overlays/<id>/` |
| Overlay dev server (`bun run dev:hai`) | `http://localhost:1467/overlay/` |

## Shortcuts

| Action | Default | Notes |
| --- | --- | --- |
| Refresh overlay | `Ctrl + Alt + I` | Broadcasts `overlay:refresh` to every connected overlay |
| Toggle mouse passthrough | `Ctrl + Alt + M` | Switches `ignoreMouseEvents` on the overlay window |
| Overlay-declared shortcuts | Defined by `overlay.json` | Registered only while that overlay is selected |

Rebind shortcuts in the Settings panel by pressing the combination you want; a registration conflict is reported below the field.

## Third-Party Overlays

Any static web bundle can be imported as an overlay: zip it with an `index.html` in the root (or in a single wrapping folder) and import it from the **Overlays** page. The archive is validated, unpacked to `Documents/ZhenHai/overlays/<id>/` and served under `/overlays/<id>/`; selecting it reloads an already open overlay window.

Overlays read live data from the local server `http://127.0.0.1:1469` over Socket.IO or REST, so they need no Electron integration. Add an `overlay.json` to declare metadata, editable settings and shortcuts. See [Overlay format](./docs/en-US/overlay-format.md) and [Realtime API](./docs/en-US/realtime-api.md).

## Architecture

```text
Zhenhai-HUD-Manager/
├── apps/
│   ├── Zhen/        # Electron app: manager UI, local server, overlay window
│   └── Hai/         # Overlay front-end (Vue 3), built into apps/Zhen/resources/overlay
├── packages/
│   └── csgogsi/     # Adapter on top of upstream csgogsi 6.0.1
├── docs/            # Documentation (zh-CN / en-US)
└── scripts/         # Repository tooling
```

| Layer | Stack |
| --- | --- |
| Manager UI | Vue 3, Pinia, Nuxt UI, Tailwind CSS, Vue Router, vue-i18n |
| Main process | Electron, Express, Socket.IO, LowDB, electron-updater, electron-log |
| Game state | [`csgogsi`](https://github.com/osztenkurden/csgogsi) 6.0.1 wrapped by `@zhenhai/csgogsi` |
| Overlay | Vue 3, Pinia, Tailwind CSS |

The manager process hosts everything the overlay needs: a REST API, a Socket.IO stream of enriched game state, and static hosting for overlay bundles. Details are in [Architecture](./docs/en-US/architecture.md).

## Development & Build

| Requirement | Version |
| --- | --- |
| Bun | `1.3.14` or newer (declared through `packageManager`) |
| Node.js | `^22.18.0` or `>=24.12.0` |
| Windows | 10 / 11 for packaging and overlay passthrough |

```bash
bun install
bun run dev        # manager + overlay dev servers
bun run typecheck  # whole workspace
bun run build      # Hai build, then the Windows installer for Zhen
```

| Scope | Scripts |
| --- | --- |
| Root | `dev`, `dev:zhen`, `dev:hai`, `build`, `typecheck`, `lint`, `format`, `clean`, `docs:check` |
| `apps/Zhen` | `dev`, `build`, `build:win`, `build:unpack`, `test`, `typecheck`, `pack:overlay` |
| `apps/Hai` | `dev`, `build`, `preview`, `type-check` |

Unit tests run on `node --test` (`bun run --cwd apps/Zhen test`) and the installer is produced by `bun run build`. More detail in [Development](./docs/en-US/development.md) and [Release](./docs/en-US/release.md).

## Security Notes

- The local server (Express + Socket.IO) listens on `127.0.0.1` by default, so other machines on the network cannot reach it.
- Enabling **Allow LAN access** in Settings switches it to `0.0.0.0`; any device on the same network can then read and write **every collection**, including app settings (LAN access, shortcuts, selected overlay) and the overlay list. Enable it only on a trusted network.
- Imported third-party overlays run as local web content and **keep full application permissions** (database access, file writes, GSI config install, updater). Only import bundles you trust; removing the overlay window preload is the switch to tighten this later.
- Zip import only validates the entry count and sizes declared in the zip header, not the real extracted size — avoid untrusted archives.

See the [HTTP API](./docs/en-US/http-api.md) for the complete exposure surface.

## Acknowledgements

Thanks to the following projects and communities for their support:

- [cshuds.com](https://cshuds.com)
- [JTsHM / OpenHUD](https://github.com/JohnTimmermann/OpenHud)
- [drweissbrot / cs-hud](https://github.com/drweissbrot/cs-hud)

And thank you to everyone who has contributed help and support to this project.
