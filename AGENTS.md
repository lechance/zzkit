# zzkit – AGENTS.md

Chrome MV3 extension. No build system, no test runner, no package.json.

## Loading & testing

- **Load in Chrome:** `chrome://extensions`, Developer mode, "Load unpacked", select repo root.
- **Reload:** refresh icon on extension card, then reopen popup.
- **Debug popup:** right-click icon > "Inspect popup".
- **Debug service worker:** click "service worker" link on extension card.
- **Debug content script:** DevTools on any tab. Logs use `[zzkit]` prefix.

## Architecture

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest. Permissions: `storage`, `cookies`, `browsingData`, `alarms`, `tabs`, `privacy`. Host: `<all_urls>`. Service worker is an **ES module** (`"type": "module"`). Content script runs at `document_start`. |
| `background.js` | Service worker. Stores config in `chrome.storage.sync`. `chrome.alarms` for periodic cleanup. `chrome.browsingData.remove` for data removal. `chrome.privacy` for WebRTC IP handling policy. Broadcasts `themeChanged` to all tabs on config save. |
| `popup.html` / `popup.js` | Popup UI with three tabs: **Theme** (dark-mode switch, auto-saves), **Privacy** (WebRTC dropdown), **Clean** (everything else + Save + Clean Now). Only Clean has Save/Clean Now buttons. Reads/writes config via `chrome.runtime.sendMessage`. CSS uses `:root` (dark default) and `:root.force-light`. |
| `content.js` | Content script on all URLs. Injects dark/light theme CSS (`themeChanged`) and has a `clearTabData` handler (localStorage, sessionStorage, IndexedDB via `webkitGetDatabaseNames`, cache). |
| `icons/` | PNG icons (16, 48, 128) + `zzkit-logo.svg` source. PNGs optimized with `optipng -o7 -strip all`. |

## Config persistence

- `chrome.storage.sync`, keyed as `{config: {...}}`.
- Defaults in `DEFAULT_CONFIG` at top of `background.js`.
- If you add a new config field, add it to `DEFAULT_CONFIG`, the DOM read in `loadConfig`, `collectConfig`, and (if it affects the UI) `updateUI`.
- `collectConfig()` must include ALL fields. Missing a field will cause `saveConfig` to overwrite storage without it, falling back to `DEFAULT_CONFIG`.

## Dark mode

- Config field `darkMode` (boolean). On → dark theme everywhere; off → light theme everywhere.
- **Popup:** `force-dark` class when on, `force-light` when off (shields the popup from the `@media (prefers-color-scheme: light)` auto block).
- **Pages:** `themeChanged` message carries `'dark'`/`'light'`; content script injects the invert-filter (dark) or `color-scheme: light` (light) styles.
- Broadcast via **two paths**: `chrome.storage.onChanged` (content script listener) **and** direct `themeChanged` runtime message (background sends to all tabs via `chrome.tabs.query({})`).
- The Dark Mode switch **auto-saves** (sends `updateConfig` on toggle); `collectConfig()` reads `#darkModeSwitch`.
- Dark injection: `filter:invert(1)hue-rotate(180deg)!important` on `html`, re-inverting `img,video,canvas,iframe,picture,embed,object,svg:not([role="img"]),[style*="background-image"],[role="img"]`, plus `html`/`body{background:#d6d5d2}` for pages that only color `<body>`. Re-inverting `svg:not([role="img"])` restores inline SVG **logos** to their original colors (visible on dark); `svg[role="img"]` icon glyphs stay under the page invert (currentColor → render light like surrounding text). Text descendants of `[style*="background-image"]`/`[role="img"]` are re-inverted again (excluding media elements) so black text inside those containers renders light. Form controls are left under the page invert (so input text stays visible/light).

## Version bump convention

Every commit increments `version` in `manifest.json` by +1 (minor bump). Current version is tracked in git.

## Popup quirks

- No on-the-fly validation of origin textarea — just `trim()` + filter empty.
- Show/hide of custom origins row is controlled by `matchAllUrls` checkbox in real-time (no save needed).
- WebRTC dropdown changes on Privacy are **not** auto-saved — they persist only when Save is clicked on Clean, or when the dark-mode switch toggles (its auto-save collects the whole DOM, including the dropdown).

## Content script notes

- Dark mode injects a `<style>` element with `filter: invert(1) hue-rotate(180deg)` on `<html>`, re-inverting media (`img,video,canvas,iframe,picture,embed,object,svg:not([role="img"]),[style*="background-image"],[role="img"]`). `svg:not([role="img"])` logos get their original explicit fills back (visible on dark), while `svg[role="img"]` icons inherit `currentColor` and stay under the page invert. Non-media descendants of `[style*="background-image"]`/`[role="img"]` are re-inverted a second time, so black text inside those containers flips back to white instead of going invisible. Form controls are not re-inverted (flipping their dark text back to dark makes it invisible on the dark page). Removes the style on mode change. `!important` prevents page CSS from overriding.
- Content script runs at `document_start` and appends the style to `document.head || document.documentElement`, so the dark filter is applied before first paint (avoids a white flash on reload).
- Light mode injects `<style>html{color-scheme:light}</style>`.
- Both `data-theme` attribute and `color-scheme` inline style are set on `<html>`.
- The `clearTabData` handler is **dead code** — neither background.js nor popup.js ever sends it. In-page cleanup effectively happens only via `browsingData`.

## Background notes

- IndexedDB via `browsingData` only works per-origin (loops over origins). When `matchAllUrls`, uses single `<all_urls>` call.
- `chrome.runtime.onInstalled` listener starts cleanup if extension was enabled before browser restart.
- `updateConfig` handler saves config, reschedules alarm, then broadcasts `themeChanged` to all tabs (silently catches errors for tabs without content script).
- WebRTC IP handling policy (`chrome.privacy.network.webRTCIPHandlingPolicy`, config field `webrtcPolicy`) is applied via `applyWebRTCPolicy()` on config save and on install/update. Feature-detected (no-op if unavailable); setting persists at browser level after uninstall (no MV3 uninstall hook). `'default'` = off.

## Keep in sync

`CLAUDE.md` mirrors much of this file (same facts, slightly different structure). If you change something fundamental here, update both.
