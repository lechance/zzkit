(() => {
  function deleteAllIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.webkitGetDatabaseNames
        ? indexedDB.webkitGetDatabaseNames()
        : null;

      if (req) {
        req.onsuccess = () => {
          const names = req.result;
          const results = [];
          for (const name of names) {
            results.push(new Promise((res) => {
              const del = indexedDB.deleteDatabase(name);
              del.onsuccess = () => res();
              del.onerror = () => res();
              del.onblocked = () => res();
            }));
          }
          Promise.all(results).then(resolve);
        };
        req.onerror = () => resolve();
      } else {
        resolve();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'clearTabData') {
      const types = message.types || {};
      const cleanup = [];

      if (types.localStorage) {
        cleanup.push(Promise.resolve().then(() => { localStorage.clear(); }));
      }
      if (types.sessionStorage) {
        cleanup.push(Promise.resolve().then(() => { sessionStorage.clear(); }));
      }
      if (types.indexedDB) {
        cleanup.push(deleteAllIndexedDB());
      }
      if (types.cacheStorage) {
        cleanup.push((async () => {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        })());
      }

      Promise.allSettled(cleanup).then(() => sendResponse({ success: true }));
      return true;
    }
    if (message.type === 'themeChanged') {
      injectTheme(effectiveTheme(message.theme || 'system'));
    }
  });

  let themeStyle = null;

  function injectTheme(theme) {
    if (themeStyle) { themeStyle.remove(); themeStyle = null; }

    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
      document.documentElement.style.colorScheme = '';
      return;
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    themeStyle = document.createElement('style');
    if (theme === 'dark') {
      themeStyle.textContent = 'html{filter:invert(1)hue-rotate(180deg)!important;background:#0d1117!important}'
        + 'img,video,canvas,svg,iframe,picture,[style*="background-image"]{filter:invert(1)hue-rotate(180deg)!important}';
    } else {
      themeStyle.textContent = 'html{color-scheme:light}';
    }
    document.head.appendChild(themeStyle);
  }

  function effectiveTheme(configTheme) {
    if (configTheme === 'dark') return 'dark';
    if (configTheme === 'light') return 'light';
    if (configTheme === 'off') return 'system';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  (async () => {
    const data = await chrome.storage.sync.get('config');
    const config = data.config || {};
    injectTheme(effectiveTheme(config.theme || 'system'));
  })();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.config) {
      const newVal = changes.config.newValue || {};
      injectTheme(effectiveTheme(newVal.theme || 'system'));
    }
  });
})();
