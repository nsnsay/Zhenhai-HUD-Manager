# Release

[简体中文](../zh-CN/release.md) · [Back to README](../../README.md)

How the workspace turns into a Windows installer, what ships inside it, and how installed clients update themselves.

## Build Pipeline

```bash
bun run build        # apps/Hai build -> apps/Zhen build:win
```

| Step | Command | Result |
| --- | --- | --- |
| 1 | `bun run --cwd apps/Hai build` | Overlay bundle written to `apps/Zhen/resources/overlay` (type-check + Vite build) |
| 2 | `bun run --cwd apps/Zhen version:patch` | Patch version bumped in `apps/Zhen/package.json` (part of `build:win`) |
| 3 | `bun run --cwd apps/Zhen build` | `typecheck` → `electron-vite build` → `pack:overlay` |
| 4 | `electron-builder --win` | NSIS installer in `apps/Zhen/dist` (electron-builder output directory; `--dir` writes `apps/Zhen/dist/win-unpacked`) |

`pack:overlay` requires the built overlay to contain `overlay.json`, stamps the app version into it, writes `dist/zhenhai-default-<version>.zip` in the repository root and deletes older bundles. That zip is a redistributable copy of the built-in overlay for re-import through the Overlays page; the `dist/` folder is git-ignored and is never referenced by `electron-builder`, so bundle zips never end up inside the installer.

## Installer Contents

`apps/Zhen/electron-builder.yml` defines the packaging:

| Setting | Value |
| --- | --- |
| Application id | `com.zhenhai.zhen` |
| Product name | `ZhenHaiHM` |
| Executable (Windows) | `zhen` |
| Installer artifact | `Zhenhai-<version>-setup.exe` (NSIS, desktop shortcut named `ZhenHai`) |
| Extra resources | `resources/overlay` → `overlay`, `resources/overlays` → `overlays`, `resources/gamestate_integration_zhenhai.cfg` → `gamestate_integration_zhenhai.cfg` |
| Unpacked from asar | `resources/**` so the GSI config and overlay files stay readable on disk |
| Update provider | GitHub, `nsnsay/ZhenHai-HUD-Manager` |
| Electron download mirror | `https://npmmirror.com/mirrors/electron/` |

Because `resources/overlay` and the GSI config live in `extraResources`, the installer layout keeps them outside the asar archive while still shipping them with the application.

## Auto Update

Installed builds check for updates through `electron-updater` and report progress over the `updater:event` IPC channel with one of these types: `checking`, `available`, `not-available`, `downloading`, `downloaded`, `error`. `downloading` carries a `percent` value that the Settings panel renders as a progress bar, and `downloaded` enables the install action (`updater:install`).

Unpackaged development builds do not update themselves; run the packaged installer to test the update flow end to end.

## Release Checklist

1. Ensure the working tree is clean and the unit tests pass (`bun run --cwd apps/Zhen test`).
2. Run `bun run build` on Windows to produce the installer (the version is bumped automatically).
3. Verify the installer: GSI config installs, the overlay opens at `/overlay/`, importing `dist/zhenhai-default-<version>.zip` works, and existing overlays are still listed.
4. Publish a GitHub release for the tag with `Zhenhai-<version>-setup.exe` attached; the publish configuration matches this repository, so `electron-builder` can also upload it directly.
5. Installed clients pick the release up through the updater and show the download progress bar before offering the restart action.
