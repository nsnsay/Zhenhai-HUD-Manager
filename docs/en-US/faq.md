# FAQ & Troubleshooting

[简体中文](../zh-CN/faq.md) · [Back to README](../../README.md)

Common problems reported while running ZhenHai HUD Manager, with the checks that usually resolve them.

## The GSI Config Fails to Install

The wizard copies `gamestate_integration_zhenhai.cfg` into `<CS2>/game/csgo/cfg/`. If it reports a missing source file or a copy failure:

1. Confirm the CS2 installation path in Settings (auto-detected through Steam, or picked manually).
2. Install the config by hand: copy `gamestate_integration_zhenhai.cfg` from the application's `resources` folder into `<Steam>\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\`.
3. Restart CS2 so it picks the file up, then confirm the HUD receives data.

The config file still carries the legacy display name `Void HUD` in its first line; that is expected and does not affect behavior.

The file points CS2 at `http://localhost:1469/gsi`, so the manager must be running for data to arrive.

## Port 1469 Is Already in Use

The local server (HTTP + Socket.IO) needs port `1469`. Close the other instance of the manager or whatever else holds the port, then restart the application. If the port stays occupied, the log records the failure and overlays cannot subscribe to live data.

## The Overlay Window or Browser Source Is Blank

| Check | Detail |
| --- | --- |
| URL | The built-in overlay is `http://127.0.0.1:1469/overlay/`; imported ones are `http://127.0.0.1:1469/overlays/<id>/` |
| Selection | The Overlays page shows which overlay is active; switching reloads an open overlay window |
| 404 for `/overlay/s/...` | A bundle built with an absolute base or history routing asks for the wrong sub-path — rebuild with `base: "./"` and hash routing |
| Data missing | Room is not sending GSI data yet, the GSI config is not installed, or no client is connected (events are not broadcast with zero clients) |

In OBS or vMix, add a browser source sized `1920 × 1080` and use the URL shown under **Toolbox → Commands & Links**.

## The Overlay Cannot Be Reached From Another Machine

By default the server listens on `127.0.0.1` only. Enable **Allow LAN access** in Settings to rebind to `0.0.0.0`, then use the host machine's LAN address (`http://<host-ip>:1469/overlay/`). Remember that this exposes the REST API to the whole network without authentication, so keep it on trusted networks only.

## Zip Import Fails

| Message | Meaning |
| --- | --- |
| `zip_no_index_html` | The archive has no `index.html`, or the folder layout is nested deeper than the single-top-level-folder case |
| `zip_unsafe_entry` | An entry uses an absolute path, a drive letter or `..` |
| `zip_symlink` | The archive contains symbolic links |
| `zip_too_many_entries` / `zip_too_large` | Entry count or declared sizes exceed the documented limits |
| Warning about absolute asset references | `index.html` references `/…` paths; the overlay may still load, but assets can 404 under `/overlays/<id>/` |

Build the archive so that `index.html` sits in the root (or in a single wrapping folder) and prefer relative asset paths.

## The Mouse Passthrough Shortcut Does Nothing

- Passthrough is toggled for the **currently open** overlay window; the shortcut does not create one.
- The default binding is `Ctrl + Alt + M`. Another application may have claimed it — rebind it in Settings, where a failed registration is reported under the field.
- Each time an overlay window is created it starts with passthrough **enabled**, so clicking the HUD requires turning it off first.

## A Shortcut Is Rejected While Rebinding

Accelerators must include `Ctrl`, `Alt` or `Super` and end with a letter, digit, function key or a supported named key. If the combination is owned by another application the registration fails, the field shows the error, and the previous binding stays in effect.

## Where Are My Data and Logs?

Everything lives in `%USERPROFILE%\Documents\ZhenHai\`: collections as JSON files, uploaded images in `assets/`, imported overlays in `overlays/`, and rolling logs in `logs/`. Copying that folder is enough to move a setup to another machine.
