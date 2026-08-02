# Site Data Cleaner – AGENTS.md

Chrome MV3 extension. No build system, no test runner, no package.json.

## Loading & testing

- **Load in Chrome:** `chrome://extensions`, Developer mode, "Load unpacked", select repo root.
- **Reload:** refresh icon on extension card, then reopen popup.
- **Debug popup:** right-click icon > "Inspect popup".
- **Debug service worker:** click "service worker" link on extension card.
- **Debug content script:** DevTools on any tab. Logs use `[SiteCleaner]` prefix.

## Architecture

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. Permissions: `storage`, `cookies`, `browsingData`, `alarms`, `tabs`, `privacy`. Host: `<all_urls>`. |
| `background.js` | Service worker. Stores config in `chrome.storage.sync`. `chrome.alarms` for periodic cleanup. `chrome.browsingData.remove` for data removal. `chrome.privacy` for WebRTC IP handling policy. Broadcasts `themeChanged` to all tabs on config save. |
| `popup.html` / `popup.js` | Popup UI. Reads/writes config via `chrome.runtime.sendMessage`. Popup CSS uses `:root` (dark default), `:root.force-light` override, and `@media (prefers-color-scheme: light)` for Auto mode. |
| `content.js` | Content script on all URLs. Handles `clearTabData` (in-tab cleanup: localStorage, sessionStorage, IndexedDB via `webkitGetDatabaseNames`, cache) and `themeChanged` (applies dark/light/page theme via injected CSS). |
| `icons/` | PNG icons (16, 48, 128). Optimized with `optipng -o7 -strip all`. |

## Config persistence

- `chrome.storage.sync`, keyed as `{config: {...}}`.
- Defaults in `DEFAULT_CONFIG` at top of `background.js`.
- `collectConfig()` in popup.js reads ALL fields from the DOM **plus** a `currentTheme` variable. If you add a new config field, add it to `DEFAULT_CONFIG`, the DOM read in `loadConfig`, and `collectConfig`.

## Theme toggle (dark/light/system/off)

Cycle: Auto → Dark → Light → Off → Auto.

| Mode | Popup | Pages |
|---|---|---|
| **Auto** | Follows `@media (prefers-color-scheme)` | Follows system `matchMedia` — applies invert filter or color-scheme |
| **Dark** | `:root` (default, no forced class needed) | `filter: invert(1) hue-rotate(180deg)` on `<html>` with `!important`; re-inverts `img,video,canvas,svg,iframe,picture,[style*="background-image"]`; also sets `body{background:#d6d5d2}` to cover pages that only color `<body>` |
| **Light** | `:root.force-light` | `color-scheme: light` on `<html>` |
| **Off** | No forced class | Removes all injected CSS, `data-theme`, `color-scheme` |

- Theme broadcasts via **two paths**: `chrome.storage.onChanged` (content script listener) **and** direct `themeChanged` runtime message (background sends to all tabs via `chrome.tabs.query({})`).
- Content script's `effectiveTheme()` resolves `'system'` via `matchMedia`, and `'off'` returns `'system'` to skip injection.
- Popup CSS variables are defined in 3 blocks: `:root` (dark default), `:root.force-light`, and `@media (prefers-color-scheme: light)` (for Auto when system is light). The `force-dark` class is still recognized but doesn't need its own block since `:root` is already dark.

## Version bump convention

Every commit increments `version` in `manifest.json` by +1 (minor bump). Current version is tracked in git.

## Popup quirks

- No on-the-fly validation of origin textarea — just `trim()` + filter empty.
- Show/hide of custom origins row is controlled by `matchAllUrls` checkbox in real-time (no save needed).
- `collectConfig()` must include ALL config fields. Missing a field will cause `saveConfig` to overwrite storage without it, falling back to `DEFAULT_CONFIG`.

## Content script notes

- Dark mode injects a `<style>` element with `filter: invert(1) hue-rotate(180deg)`. Removes it on mode change. `!important` prevents page CSS from overriding.
- Light mode injects `<style>html{color-scheme:light}</style>`.
- Both `data-theme` attribute and `color-scheme` inline style are set on `<html>`.

## Background notes

- IndexedDB via `browsingData` only works per-origin (loops over origins). When `matchAllUrls`, uses single `<all_urls>` call.
- `chrome.runtime.onInstalled` listener starts cleanup if extension was enabled before browser restart.
- `updateConfig` handler saves config, reschedules alarm, then broadcasts `themeChanged` to all tabs (silently catches errors for tabs without content script).
- WebRTC IP handling policy (`chrome.privacy.network.webRTCIPHandlingPolicy`, config field `webrtcPolicy`) is applied via `applyWebRTCPolicy()` on config save and on install/update. Feature-detected (no-op if unavailable); setting persists at browser level after uninstall (no MV3 uninstall hook). `'default'` = off.
