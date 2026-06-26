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
  });
})();
