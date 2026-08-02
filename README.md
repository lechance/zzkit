# zzkit

A Chrome extension that automatically clears site data (localStorage, sessionStorage, IndexedDB, cookies, cache storage) at configurable intervals, plus privacy extras: an invert-filter dark mode and WebRTC IP-leak prevention.

## Features

- **Scheduled cleanup** — clears site data on a timer (default 60 min), scoped to all URLs or a custom origin list.
- **Dark mode** — one-click invert-filter dark theme across all pages, applied before first paint to avoid a white flash.
- **WebRTC protection** — restrict which IP addresses WebRTC may expose.

## Install

Chrome MV3 extension. No build step, no dependencies.

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select this repo root

## Usage

The popup has three tabs:

- **Theme** — dark mode switch (auto-saves on toggle)
- **Privacy** — WebRTC IP handling policy (saved when you click Save)
- **Clean** — enable/disable scheduled cleanup, interval, data types, scope, Save and Clean Now

## Development

- Reload: refresh icon on the extension card, then reopen the popup.
- Debug popup: right-click the icon > "Inspect popup".
- Debug service worker: click the "service worker" link on the extension card.
- Debug content script: open DevTools on any tab. Logs use the `[zzkit]` prefix.

See `AGENTS.md` for architecture and conventions.
