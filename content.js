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

  const OS_DARK_MQ = window.matchMedia('(prefers-color-scheme: dark)');
  const DARK_THRESHOLD = 0.35;
  const LIGHT_BG = '#d6d5d2';
  const DARK_INVERT = 'filter:invert(1)hue-rotate(180deg)!important';
  const MEDIA = 'img,video,canvas,iframe,picture,embed,object';
  const NOT_MEDIA = ':not(img):not(video):not(canvas):not(iframe):not(picture):not(embed):not(object)';

  let invertStyle = null; // dark: filter + media/text re-invert | light: html{color-scheme:light}
  let bgStyle = null;     // dark only: html/body background override
  let themeToken = 0;     // bumped on every injectTheme(); stale async measurements bail
  let darkEnabled = false;

  function makeStyle(css) {
    const s = document.createElement('style');
    s.textContent = css;
    return s;
  }

  function appendStyle(s) {
    (document.head || document.documentElement).appendChild(s);
  }

  function removeStyles() {
    if (invertStyle) { invertStyle.remove(); invertStyle = null; }
    if (bgStyle) { bgStyle.remove(); bgStyle = null; }
  }

  // Dark CSS lives in two <style> elements so the background override can be
  // removed (synchronously, no paint) to read the page's real background color.
  // getComputedStyle().backgroundColor is unaffected by the filter property, so
  // the invert can stay applied during the measurement.
  function applyDarkFilter() {
    invertStyle = makeStyle(
      `html{${DARK_INVERT}}` +
      `${MEDIA},svg:not([role="img"]),[style*="background-image"],[role="img"]{${DARK_INVERT}}` +
      // Text inside re-inverted containers is flipped back to black by the rule above;
      // re-invert it so originally-black text renders light again. Skip the media elements.
      `[style*="background-image"] ${NOT_MEDIA},[role="img"] ${NOT_MEDIA}{${DARK_INVERT}}`
    );
    bgStyle = makeStyle(`html{background:${LIGHT_BG}!important}body{background:${LIGHT_BG}!important}`);
    appendStyle(invertStyle);
    appendStyle(bgStyle);
  }

  function applyLightFilter() {
    invertStyle = makeStyle('html{color-scheme:light}');
    appendStyle(invertStyle);
  }

  function injectTheme(theme) {
    removeStyles();
    themeToken++;
    if (theme === 'system') {
      darkEnabled = false;
      delete document.documentElement.dataset.theme;
      document.documentElement.style.colorScheme = '';
      return;
    }
    darkEnabled = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (theme === 'light') { applyLightFilter(); return; }
    // OS light: apply immediately at document_start (avoids a white flash), then
    // back off at ready if the page turns out natively dark.
    if (!OS_DARK_MQ.matches) applyDarkFilter();
    // OS dark: the page may already be dark (native or OS-following) — measure
    // first and only apply the invert if the page is actually light.
    scheduleThemeMeasurement();
  }

  function whenReady(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      // Already interactive/complete (e.g. injected late after extension reload);
      // let the current style recalc settle before measuring.
      requestAnimationFrame(() => requestAnimationFrame(cb));
    }
  }

  function scheduleThemeMeasurement() {
    const token = themeToken;
    whenReady(() => {
      if (token !== themeToken) return;
      if (!darkEnabled) return;
      if (pageLooksDark()) {
        // Site already renders dark — leave it alone (data-theme/color-scheme stay).
        removeStyles();
      } else if (!invertStyle) {
        // OS-dark branch: page is light, invert now.
        applyDarkFilter();
      }
      // OS-light branch: invertStyle already present — keep it.
    });
  }

  function pageLooksDark() {
    const root = document.documentElement;
    const savedScheme = root.style.colorScheme;
    const hadBgStyle = !!bgStyle;
    if (hadBgStyle) bgStyle.remove(); // drop our override so we read the page's real color
    try {
      let bg = null;
      if (document.body) {
        bg = parseColor(getComputedStyle(document.body).backgroundColor);
        if (bg && bg.a < 0.5) bg = null;
      }
      if (!bg) {
        bg = parseColor(getComputedStyle(root).backgroundColor);
        if (bg && bg.a < 0.5) bg = null;
      }
      if (bg) return luminance(bg) < DARK_THRESHOLD;

      // Everything transparent — the canvas color follows the page's own color-scheme.
      root.style.colorScheme = ''; // clear OUR override so we read the page's own
      const scheme = getComputedStyle(root).colorScheme;
      return scheme === 'dark' || (scheme === 'light dark' && OS_DARK_MQ.matches);
    } finally {
      root.style.colorScheme = savedScheme;
      if (hadBgStyle) appendStyle(bgStyle);
    }
  }

  function parseColor(css) {
    if (!css || css === 'transparent') return null;
    const m = css.match(/^rgba?\((.+)\)$/);
    if (!m) return null;
    const p = m[1].match(/[\d.]+/g);
    if (!p || p.length < 3) return null;
    const r = parseFloat(p[0]);
    const g = parseFloat(p[1]);
    const b = parseFloat(p[2]);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a: p.length > 3 ? parseFloat(p[3]) : 1 };
  }

  // WCAG relative luminance — the page is "already dark" when it falls below the threshold.
  function luminance({ r, g, b }) {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  // Re-decide when the OS theme flips: a page that follows the OS re-renders, so
  // back off (un-invert) or apply accordingly.
  OS_DARK_MQ.addEventListener('change', () => {
    if (darkEnabled) {
      requestAnimationFrame(() => requestAnimationFrame(() => injectTheme('dark')));
    }
  });

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
