(() => {
  function deleteAllIndexedDB() {
    return new Promise((resolve) => {
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
      const DARK_INVERT = 'filter:invert(1)hue-rotate(180deg)!important';
      const LIGHT_BG = '#d6d5d2';
      themeStyle.textContent = [
        `html{${DARK_INVERT};background:${LIGHT_BG}!important}`,
        `body{background:${LIGHT_BG}!important}`,
        `img,video,canvas,iframe,picture,embed,object,[style*="background-image"],[role="img"]{${DARK_INVERT}}`,
      ].join('');
    } else {
      themeStyle.textContent = 'html{color-scheme:light}';
    }
    (document.head || document.documentElement).appendChild(themeStyle);
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
    injectTheme(config.darkMode ? 'dark' : 'light');
  })();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.config) {
      const newVal = changes.config.newValue || {};
      injectTheme(newVal.darkMode ? 'dark' : 'light');
    }
  });
})();
