# Overlay Format

[简体中文](../zh-CN/overlay-format.md) · [Back to README](../../README.md)

Any static web bundle can be used as an overlay. A zip containing an `index.html` is enough; adding an `overlay.json` manifest lets the bundle declare metadata, editable settings, forced values and its own global shortcuts.

## Importing a Zip

1. Open the **Overlays** page and choose **Import Overlay (.zip)**.
2. The manager unpacks the archive into a temporary directory, validates every entry, and moves the result to `%USERPROFILE%\Documents\ZhenHai\overlays\<id>\`.
3. The overlay is registered in the `overlays` collection, becomes the selected overlay, and `/overlays/<id>/` serves it immediately.

The overlay id is derived from the zip file name (lower-case letters, digits and dashes; conflicts get a numeric suffix).

### Validation Rules

| Rule | Limit |
| --- | --- |
| Entry count | At most `5000` |
| Single entry | At most `256 MB` uncompressed |
| Total uncompressed size | At most `512 MB` |
| Entry path length | At most `240` characters |
| Paths | No absolute paths, drive letters, `..` segments or NUL bytes |
| Links | Symbolic links are rejected |
| Entry file | `index.html` must exist at the root, or inside the single top-level folder of the archive |

Sizes are read from the zip header; the archive is not re-measured after extraction, so avoid untrusted bundles.

## The `overlay.json` Manifest

The manifest is read from the overlay folder on startup and when its settings dialog is opened. Both `overlay.json` (current) and `zhenhai.overlay.json` (legacy) are recognised, in that order.

```json
{
  "manifestVersion": 1,
  "name": "My Broadcast HUD",
  "description": "Sidebars, scoreboard and round banner",
  "version": "1.4.0",
  "author": "your-name",
  "homepage": "https://example.com/my-hud",
  "settings": {
    "somePlaceBorderRadius": 12,
    "showRadar": true,
    "accentColor": "#ff5c5c"
  },
  "override": {
    "extras": {
      "playerBoxOpacity": 1
    }
  },
  "shortcuts": [
    {
      "id": "toggle-scoreboard",
      "name": "Toggle scoreboard",
      "default": "CommandOrControl+Alt+S",
      "description": "Shown while the scoreboard overlay is visible"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `manifestVersion` | Manifest schema version; currently `1` |
| `name`, `description`, `version`, `author`, `homepage` | Metadata shown in the overlay list and settings dialog |
| `settings` | Editable defaults; the user can change these per overlay in the app |
| `override` | Values that always win for this overlay and cannot be edited by the user |
| `shortcuts` | Global shortcuts registered while this overlay is selected |

### Manifest Limits

| Rule | Limit |
| --- | --- |
| Manifest file size | At most `64 KB` |
| `settings` / `override` keys | At most `64` each |
| Key names | `^[A-Za-z][A-Za-z0-9_.-]*$` |
| `shortcuts` | At most `16` entries |
| Shortcut ids | `^[a-z][a-z0-9-]*$`, unique within the manifest |
| Shortcut accelerators | Must contain a modifier (`Ctrl`/`Alt`/`Shift`/`Super`), unique within the manifest |

Anything over a limit or with an invalid shape is dropped and reported as a warning instead of failing the whole import.

## Effective Settings

Values sent to the overlay are composed in this order (later wins):

1. Application settings (Settings panel).
2. `manifest.settings` defaults.
3. Values the user edited in the overlay's settings dialog.
4. `manifest.override`.

`extras` is merged key by key rather than replaced as a whole. The same composed object is used for `data.settings` in the GSI payload and for `GET /api/settings`, so both outputs always agree.

The override only affects the payload sent to the overlay. Application runtime keys — LAN access, application shortcuts, window material, CS2 path, selected overlay, first-start flag — are never controlled by a third-party manifest.

## Shortcuts

Shortcuts declared in the manifest are registered as global shortcuts while that overlay is selected and are unregistered when you switch away. Pressing one broadcasts `overlay:shortcut` on Socket.IO (see [Realtime API](./realtime-api.md)) and notifies the built-in overlay window over IPC. Application shortcuts win on conflict; conflicting overlay shortcuts are reported in the settings dialog.

## Authoring Checklist

- Build with a **relative base** (`base: "./"` in Vite) and prefer hash routing. Bundles that request absolute paths such as `/assets/index.js` break when served from `/overlays/<id>/`.
- Keep `index.html` in the root of the archive, or wrap the whole build in a single top-level folder.
- Read live data from `http://127.0.0.1:1469` (Socket.IO) instead of expecting the overlay to be preloaded with data.
- Use `overlay.json` rather than `zhenhai.overlay.json` for new bundles.
- Test the bundle both as a zip import and through the development-server entry (URL plus route) before publishing it.

## Debugging

| Symptom | Cause / fix |
| --- | --- |
| Blank page, console shows 404s for `/assets/...` | The bundle was built with an absolute base; rebuild with `base: "./"` |
| `Unknown overlay: <id>` | The id is not registered — import the bundle again or check the folder name |
| Assets load but no data appears | No Socket.IO connection to `http://127.0.0.1:1469`, or CS2 is not sending GSI data |
| Import warning about absolute asset references | `index.html` references `/…` paths; see the first row |
