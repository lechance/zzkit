# Site Data Cleaner – AGENTS.md

Chrome MV3 extension. No build system, no test runner, no package.json.

## Loading & testing

- **Load in Chrome:** go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select repo root.
- **Reload after changes:** click the refresh icon on the extension card in `chrome://extensions`, then open/open the popup.
- **Debug popup:** right-click the extension icon > "Inspect popup".
- **Debug service worker:** in `chrome://extensions`, click the extension's "service worker" link to open its DevTools console.
- **Debug content script:** open DevTools on any tab, look in the console. Messages include `[SiteCleaner]` prefixes.

## Architecture

| File | Role |
|---|---|
| `manifest.json` | Chrome MV3 manifest; permissions: `storage`, `cookies`, `browsingData`, `alarms`, `tabs` |
| `background.js` | Service worker — stores config in `chrome.storage.sync`, uses `chrome.alarms` for periodic cleanup, `chrome.browsingData.remove` for data removal |
| `popup.html` / `popup.js` | Popup UI — reads/writes config via `chrome.runtime.sendMessage` to background |
| `content.js` | Content script injected on all tabs — handles `clearTabData` messages for in-tab cleanup (localStorage, sessionStorage, IndexedDB via `webkitGetDatabaseNames`, cache storage) |

## Key details

- **Config persistence:** `chrome.storage.sync`, keyed as `{config: {...}}`. Defaults in `DEFAULT_CONFIG` in `background.js:1`.
- **Scope logic:** When `matchAllUrls` is on, cleanup targets `<all_urls>`. When off, cleanup targets only the user-specified origins (custom per-line textarea).
- **IndexedDB via `browsingData`:** only works per-origin (loop in `background.js:49`). When using `<all_urls>`, indexedDB is cleaned as a single call.
- **Content script** handles in-tab cleanup for data not covered by `browsingData` API. Called via runtime message `{type: "clearTabData", types: {...}}`.
- **Alarm scheduling:** `chrome.alarms.create('siteCleanup', {periodInMinutes: ...})` — cleared and recreated on config save.
- **`chrome.runtime.onInstalled`** listener starts cleanup if extension was enabled before browser restart.
- **Popup has no on-the-fly validation** of origin textarea format — just trims and filters empties.

## No CI / no tests

There is no CI or test suite. Verify changes by loading the unpacked extension and manually testing the popup, the "Clean Now" button, and the periodic alarm.
