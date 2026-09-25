# Development

[简体中文](../zh-CN/development.md) · [Back to README](../../README.md)

Everything needed to run, type-check and build ZhenHai HUD Manager from source.

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Bun | `1.3.14` or newer | Declared through `packageManager` in the root `package.json`; used for install and scripts |
| Node.js | `^22.18.0` or `>=24.12.0` | Required by `apps/Hai`; `csgogsi` needs Node `>=22.12.0` |
| Windows | 10 / 11 | Supported target: window materials (acrylic/mica), overlay passthrough and the NSIS installer are Windows-first. `build:mac` / `build:linux` scripts exist but are not maintained here |

## Install

```bash
bun install
```

`postinstall` in `apps/Zhen` runs `electron-builder install-app-deps`, and native modules such as `bufferutil` / `utf-8-validate` / `sass-embedded` are declared as trusted dependencies.

## Development Servers

```bash
bun run dev        # both apps through Turborepo
bun run dev:zhen   # Electron manager only (electron-vite dev --watch)
bun run dev:hai    # overlay only (Vite dev server on http://localhost:1467/overlay/)
```

While developing the overlay, register a development overlay in the **Overlays** page pointing at `http://localhost:1467/overlay/` (plus an optional route) and select it — the overlay window then loads straight from Vite with hot reload. Development overlays can only be created in unpackaged builds.

## Scripts

| Location | Script | Purpose |
| --- | --- | --- |
| Root | `dev` / `dev:zhen` / `dev:hai` | Development servers through Turborepo |
| Root | `build` | Builds `apps/Hai`, then packages `apps/Zhen` for Windows |
| Root | `typecheck` | `turbo run typecheck` across the workspace |
| Root | `lint` / `format` / `clean` | `oxlint`, `oxfmt`, `turbo run clean` |
| Root | `docs:check` | Validates README/docs links, language mirror parity and placeholders |
| `apps/Zhen` | `dev` | `electron-vite dev --watch` |
| `apps/Zhen` | `build` | `typecheck` → `electron-vite build` → `pack:overlay` |
| `apps/Zhen` | `build:win` | Bumps the patch version, builds, then `electron-builder --win` |
| `apps/Zhen` | `test` | `node --test` unit suite |
| `apps/Zhen` | `typecheck` | `typecheck:node` + `typecheck:web` + `typecheck:test` |
| `apps/Zhen` | `pack:overlay` | Installs the built-in overlay into `resources/overlay` and zips it into the repository `dist/` folder |
| `apps/Hai` | `dev` / `build` / `preview` | Vite dev server, type-check plus production build, local preview |
| `apps/Hai` | `pack` | Build, verify, generate the manifest, emit `dist/zhenhai-<bundle>-<version>.zip` |
| `apps/Hai` | `type-check` | `vue-tsc --build` |

An overlay front-end project declares its packaging metadata in its own `package.json` under `zhenhaiOverlay` (`bundleName`, `displayName` and optional `description`, `author`, `versionFrom`, `installTo`). `bun run pack` builds, verifies, writes `name`/`description`/`author`/`version` into the built manifest and drops the zip into the repository `dist/`; a project with `installTo` (the built-in default overlay) also mirrors its build into `apps/Zhen/resources/overlay`. Any other overlay project packs independently with `bun <repo>/apps/Hai/scripts/pack-overlay.mjs --project <dir>` and never touches the manager's resource folders.

## Tests

```bash
bun run --cwd apps/Zhen test
```

The suite runs on `node --test` with no extra dependencies and covers the accelerator helpers, reference cleanup, locale resolution, i18n message parity, the overlay manifest (parsing, settings composition, bindings), zip validation, overlay URL resolution, the observer slot mapping and the GSI enrichment hook.

`apps/Hai` ships a Vitest and Playwright configuration for overlay-side tests and is verified in this repository through `bun run --cwd apps/Hai type-check`.

## Type Checking

```bash
bun run typecheck                 # whole workspace
bun run --cwd apps/Zhen typecheck # main + renderer + tests
bun run --cwd apps/Hai type-check # overlay
```

## Conventions

- `const` by default, `let` only when reassignment is needed; no `var`.
- No bare `any`: unknown input is validated and narrowed, errors are handled with `unknown` plus the shared `errorMessage()` helper.
- Dependencies are pinned where it matters (`csgogsi` is locked to `6.0.1`) and the lockfile is committed.
- Pure logic lives in `apps/Zhen/src/shared` (or `pipelines/`) so it can be unit-tested without Electron or the DOM.
- Renderer code uses Vue 3 `<script setup lang="ts">`, Pinia stores under `renderer/src/stores` and pure helpers under `renderer/src/utils`.
- User-facing strings in the manager are localized through `vue-i18n` (`renderer/src/locales`); logs and main-process text stay English for greppability.
