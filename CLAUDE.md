# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Site Data Cleaner** — a Chrome MV3 extension that automatically clears site data (localStorage, sessionStorage, IndexedDB, cookies, cache storage) at configurable intervals. Zero build system, zero dependencies, zero tests.

## Quick Start

- **Load in Chrome:** Open `chrome://extensions`, enable Developer mode, click "Load unpacked", select repo root.
- **Reload:** Click the refresh icon on the extension card, then reopen the popup.
- **Debug popup:** Right-click extension icon → "Inspect popup".
- **Debug service worker:** Click the "service worker" link on the extension card.
- **Debug content script:** Open DevTools on any tab. Logs use `[SiteCleaner]` prefix.

## Architecture

See `AGENTS.md` for the full architecture reference. Key structure:

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest — permissions: `storage`, `cookies`, `browsingData`, `alarms`, `tabs` |
| `background.js` | Service worker — config persistence (`chrome.storage.sync`), alarm-based periodic cleanup (`chrome.browsingData.remove`), message hub |
| `popup.html` / `popup.js` | Popup UI — reads/writes config via `chrome.runtime.sendMessage`, toggles theme, triggers manual cleanup |
| `content.js` | Content script (all URLs) — in-tab data clearing (`localStorage.clear()`, `indexedDB.deleteDatabase()`, etc.) and theme injection (dark/light/page modes via injected CSS) |
| `icons/` | PNG icons (16, 48, 128 px) |

## Config

- Persisted in `chrome.storage.sync` as `{config: {...}}`.
- Defaults defined in `DEFAULT_CONFIG` at the top of `background.js`.
- When adding a new config field: add it to `DEFAULT_CONFIG`, wire it in `loadConfig()` (read from storage into DOM), `collectConfig()` (read from DOM into object), and `updateUI()` (reflect in UI).

## Theme

Cycle: Auto → Dark → Light → Off → Auto. Theme broadcasts via two paths: `chrome.storage.onChanged` + direct runtime `themeChanged` message to all tabs. See `AGENTS.md` for the full theme table.

## Version Bump

Every commit increments `version` in `manifest.json` by +1 (minor bump).

## Key Patterns

- **Cleanup:** `background.js` sends `chrome.browsingData.remove()` calls in parallel (`Promise.allSettled`). `content.js` handles in-tab fallbacks (localStorage, sessionStorage, IndexedDB via `webkitGetDatabaseNames`, cache API).
- **IndexedDB quirk:** `browsingData` only works per-origin — loops over origins individually. When `matchAllUrls`, uses single `<all_urls>` call.
- **Message types:** `runCleanupNow`, `updateConfig`, `getConfig` (background.js) and `clearTabData`, `themeChanged` (content.js).
- **Popup UI:** No on-the-fly validation. `matchAllUrls` toggles the custom origins textarea visibility in real-time.
