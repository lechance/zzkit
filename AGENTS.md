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
| `content.js` | Content script on all URLs. Injects dark/light theme CSS (`themeChanged`), measuring the page background to leave already-dark pages alone, and has a `clearTabData` handler (localStorage, sessionStorage, IndexedDB via `webkitGetDatabaseNames`, cache). |
| `icons/` | PNG icons (16, 48, 128) + `zzkit-logo.svg` source. PNGs optimized with `optipng -o7 -strip all`. |

## Config persistence

- `chrome.storage.sync`, keyed as `{config: {...}}`.
- Defaults in `DEFAULT_CONFIG` at top of `background.js`.
- If you add a new config field, add it to `DEFAULT_CONFIG`, the DOM read in `loadConfig`, `collectConfig`, and (if it affects the UI) `updateUI`.
- `collectConfig()` must include ALL fields. Missing a field will cause `saveConfig` to overwrite storage without it, falling back to `DEFAULT_CONFIG`.

## Dark mode

- Config field `darkMode` (boolean). On → dark theme everywhere; off → light theme everywhere.
- **Popup:** `force-dark` class when on, `force-light` when off (shields the popup from the `@media (prefers-color-scheme: light)` auto block).
- **Pages:** `themeChanged` message carries `'dark'`/`'light'`; content script injects the invert-filter (dark) or `color-scheme: light` (light) styles — but measures the page's real background and skips pages that already render dark.
- Broadcast via **two paths**: `chrome.storage.onChanged` (content script listener) **and** direct `themeChanged` runtime message (background sends to all tabs via `chrome.tabs.query({})`).
- The Dark Mode switch **auto-saves** (sends `updateConfig` on toggle); `collectConfig()` reads `#darkModeSwitch`.
- Dark injection: invert filter on `html` (`filter:invert(1)hue-rotate(180deg)!important`) plus a **separate** `html`/`body{background:#d6d5d2}` override (kept apart so it can be dropped, synchronously no paint, to read the page's true background). Media, SVG logos, and text inside re-inverted containers get re-inverted so they stay visible — full selector list and rationale in Content script notes below. **Already-dark pages are skipped** — see Content script notes.

## Version bump convention

Every commit increments `version` in `manifest.json` by +1 (minor bump). Current version is tracked in git.

## Popup quirks

- No on-the-fly validation of origin textarea — just `trim()` + filter empty.
- Show/hide of custom origins row is controlled by `matchAllUrls` checkbox in real-time (no save needed).
- WebRTC dropdown changes on Privacy are **not** auto-saved — they persist only when Save is clicked on Clean, or when the dark-mode switch toggles (its auto-save collects the whole DOM, including the dropdown).

## Content script notes

- Dark mode injects **two `<style>` elements**: an invert filter (`filter: invert(1) hue-rotate(180deg)` on `<html>`) and an `html/body{background:#d6d5d2}` override (kept separate so the override can be removed — synchronously, no paint — to read the page's real background). The filter re-inverts media (`img,video,canvas,iframe,picture,embed,object,svg:not([role="img"]),[style*="background-image"],[role="img"]`). `svg:not([role="img"])` logos get their original explicit fills back (visible on dark), while `svg[role="img"]` icons inherit `currentColor` and stay under the page invert. Non-media descendants of `[style*="background-image"]`/`[role="img"]` are re-inverted a second time, so black text inside those containers flips back to white instead of going invisible. Form controls are not re-inverted (flipping their dark text back to dark makes it invisible on the dark page). Removes the styles on mode change. `!important` prevents page CSS from overriding.
- **Already-dark skip:** once the document is ready, the content script measures the page's real background — `getComputedStyle(document.body)` then `documentElement` background-color luminance < 0.35 → already dark; if both are transparent it falls back to the page's own `color-scheme` (`'dark'`, or `'light dark'` resolved by OS preference). If the page already renders dark (native dark theme, or OS-following when the OS is dark) it removes the invert and leaves the page alone — `data-theme="dark"` and `color-scheme: dark` stay set. Timing: OS prefers light → filter applied at `document_start` (no white flash), backed off at ready if the page turns out natively dark; OS prefers dark → filter applied only after the measurement, so already-dark pages are never flashed. A `themeToken` is bumped on every `injectTheme()` so stale async measurements bail; the decision is re-run when the OS `prefers-color-scheme` flips.
- The `themeChanged` handler runs the theme through `effectiveTheme()` (content.js), which also maps `'off'` → `'system'` and falls back to OS `prefers-color-scheme`. background.js only ever sends `'dark'`/`'light'` (from the boolean `darkMode`), so those extra branches are reachable only from a future sender.
- Content script runs at `document_start` and appends the style to `document.head || document.documentElement`, so the dark filter is applied before first paint (avoids a white flash on reload).
- Light mode injects `<style>html{color-scheme:light}</style>`.
- Both `data-theme` attribute and `color-scheme` inline style are set on `<html>`.
- The `clearTabData` handler is **dead code** — neither background.js nor popup.js ever sends it. In-page cleanup effectively happens only via `browsingData`.

## Background notes

- IndexedDB via `browsingData` only works per-origin (loops over origins). When `matchAllUrls`, uses single `<all_urls>` call.
- `chrome.runtime.onInstalled` listener starts cleanup if extension was enabled before browser restart.
- `updateConfig` handler saves config, reschedules alarm, then broadcasts `themeChanged` to all tabs (silently catches errors for tabs without content script).
- WebRTC IP handling policy (`chrome.privacy.network.webRTCIPHandlingPolicy`, config field `webrtcPolicy`) is applied via `applyWebRTCPolicy()` on config save and on install/update. Feature-detected (no-op if unavailable); setting persists at browser level after uninstall (no MV3 uninstall hook). `'default'` = off.
- **Message types** (background.js): `getConfig` → returns merged config; `updateConfig` → saves, applies WebRTC policy, reschedules alarm, broadcasts `themeChanged`; `runCleanupNow` → immediate cleanup. Content script listens for `themeChanged` and the dead `clearTabData`.

## Keep in sync

`CLAUDE.md` mirrors much of this file (same facts, slightly different structure). If you change something fundamental here, update both.
