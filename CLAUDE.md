# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**zzkit** — a Chrome MV3 extension that clears site data (localStorage, sessionStorage, IndexedDB, cookies, cache storage) at configurable intervals, plus privacy extras: an invert-filter dark mode and WebRTC IP-leak prevention. Zero build system, zero dependencies, zero tests. No package.json, no lint, no test runner — "testing" means loading the unpacked extension in Chrome and inspecting.

## Quick Start

- **Load in Chrome:** Open `chrome://extensions`, enable Developer mode, click "Load unpacked", select repo root.
- **Reload:** Click the refresh icon on the extension card, then reopen the popup.
- **Debug popup:** Right-click extension icon → "Inspect popup".
- **Debug service worker:** Click the "service worker" link on the extension card.
- **Debug content script:** Open DevTools on any tab. Logs use `[zzkit]` prefix.

## Architecture

See `AGENTS.md` for the full architecture reference. Key structure:

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest — permissions: `storage`, `cookies`, `browsingData`, `alarms`, `tabs`, `privacy`. Service worker is an **ES module** (`"type": "module"`), so any future `import` statements must use ESM syntax. Content script runs at `document_start`. |
| `background.js` | Service worker — config persistence (`chrome.storage.sync`), alarm-based periodic cleanup (`chrome.browsingData.remove`), message hub, WebRTC policy via `chrome.privacy`. |
| `popup.html` / `popup.js` | Popup UI — three tabs (Theme, Privacy, Clean). The Dark Mode switch auto-saves; the WebRTC dropdown saves via the Clean tab's Save button. |
| `content.js` | Content script (all URLs, `document_start`) — theme injection via an invert-filter `<style>` applied before first paint, measuring the page background to skip pages that are already dark, plus a `clearTabData` handler. |
| `icons/` | PNG icons (16, 48, 128 px) + `zzkit-logo.svg` source. |

## Config

- Persisted in `chrome.storage.sync` as `{config: {...}}`.
- Defaults defined in `DEFAULT_CONFIG` at the top of `background.js`.
- When adding a new config field: add it to `DEFAULT_CONFIG`, wire it in `loadConfig()` (read from storage into DOM), `collectConfig()` (read from DOM into object), and `updateUI()` (reflect in UI).
- **Critical:** `collectConfig()` must return EVERY field — a missing field makes `saveConfig` overwrite storage without it, silently falling back to `DEFAULT_CONFIG`.
- `webrtcPolicy` (WebRTC IP handling dropdown) is applied via `chrome.privacy.network.webRTCIPHandlingPolicy` on save/install — not part of cleanup logic. Feature-detected (no-op if the API is unavailable, e.g. Firefox); setting persists at browser level even after uninstall (no MV3 uninstall hook). `'default'` = off.
- `darkMode` (Dark Mode switch, boolean) is broadcast as a `themeChanged` `'dark'`/`'light'` message on save/toggle — not part of cleanup logic.

## Theme

`darkMode` (boolean) toggles dark theme on/off via a switch in the **Theme** tab. On → dark theme; off → light. Pages that already render dark (native dark theme or OS-following) are left unchanged. The switch auto-saves on toggle. Broadcasts via two paths: `chrome.storage.onChanged` + direct runtime `themeChanged` message to all tabs.

**Popup CSS theming** (matters when editing `popup.html`): CSS variables default to dark via `:root`; `:root.force-light` switches to light; a `@media (prefers-color-scheme: light)` block applies light unless `force-dark`/`force-light` is present. `popup.js`'s `applyDarkMode()` toggles those two classes.

## Version Bump

Every commit increments `version` in `manifest.json` by +1 (minor bump).

## Key Patterns

- **Cleanup:** `background.js` sends `chrome.browsingData.remove()` calls in parallel (`Promise.allSettled`), one task per enabled data type. **All in-page data clearing goes through `browsingData`** — the `clearTabData` handler in `content.js` is dead code that nothing ever sends (localStorage, sessionStorage, IndexedDB, cache).
- **IndexedDB quirk:** `browsingData` only works per-origin — loops over origins individually. When `matchAllUrls`, uses single `<all_urls>` call.
- **Message types:** `runCleanupNow`, `updateConfig`, `getConfig` (background.js) and `clearTabData` (dead), `themeChanged` (content.js). `updateConfig` also applies the WebRTC policy as a side effect.
- **Dark mode injection:** content.js injects the dark CSS as two `<style>` elements — an invert filter (`html{filter:invert(1)hue-rotate(180deg)}!important`) and a `html/body{background:#d6d5d2}` override (split so the override can be removed — synchronously, no paint — to read the page's real background). It re-inverts `img,video,canvas,iframe,picture,embed,object,svg:not([role="img"]),[style*="background-image"],[role="img"]` so media isn't negative and inline SVG **logos** (explicit fills, no `role="img"`) keep their original colors — visible on dark. `svg[role="img"]` icon glyphs stay under the page invert (they use `currentColor`, so they render light like the surrounding text). It then re-inverts the **text descendants** of `[style*="background-image"]`/`[role="img"]` (excluding the media elements) so originally-black text inside those containers stays light. It deliberately leaves form controls under the page invert so input text stays visible. **Already-dark pages are skipped:** after the page's styles load, it measures the page's real background (`getComputedStyle` luminance < 0.35 → dark; transparent backgrounds fall back to the page's own `color-scheme`) and if the page already renders dark — native dark theme, or OS-following when the OS is dark — it removes the invert and leaves the page alone (`data-theme="dark"` + `color-scheme: dark` stay set). When the OS prefers light, the filter applies at `document_start` (no white flash) and backs off at ready if the page is natively dark; when the OS prefers dark, applying is deferred until the measurement so already-dark pages are never flashed. The measurement waits for the page's styles: at `DOMContentLoaded` when injected early, but for `load` when injected late (readyState `interactive`, e.g. the async `storage.get` boot or an extension reload), so it never reads a still-transparent background and wrongly inverts an already-dark page; a token-guarded one-shot `load` re-check re-runs the decision as a safety net (SPAs that theme after `DOMContentLoaded` self-correct). Re-decides when the OS `prefers-color-scheme` flips. Light mode injects `html{color-scheme:light}`.
- **Popup tabs:** `switchTab()` toggles `.tab-btn`/`.tab-panel` active classes; default tab is Theme. `collectConfig()` reads all fields across tabs, so saving from Clean persists Privacy/Theme changes too.
- **Popup UI:** No on-the-fly validation. `matchAllUrls` toggles the custom origins textarea visibility in real-time. WebRTC dropdown changes on Privacy are **not** auto-saved — they persist only when Save is clicked on Clean, or when the dark-mode switch auto-saves (its `collectConfig()` reads the whole DOM, dropdown included).

## Keep in sync

`AGENTS.md` is the full architecture reference and documents the same facts in more depth. If you change something fundamental here, update both.
