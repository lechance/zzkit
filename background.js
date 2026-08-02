const DEFAULT_CONFIG = {
  enabled: false,
  intervalMinutes: 60,
  clearLocalStorage: true,
  clearSessionStorage: true,
  clearIndexedDB: true,
  clearCookies: true,
  clearCache: true,
  origins: [],
  matchAllUrls: true,
  theme: 'system',
  webrtcPolicy: 'default',
};

async function getConfig() {
  const data = await chrome.storage.sync.get('config');
  return { ...DEFAULT_CONFIG, ...data.config };
}

async function saveConfig(config) {
  await chrome.storage.sync.set({ config });
}

function originsToClean(config) {
  if (config.matchAllUrls || config.origins.length === 0) {
    return ['<all_urls>'];
  }
  return config.origins.map(o => o.trim()).filter(Boolean);
}

async function clearBrowsingData(dataType, origins) {
  const options = { origins };
  await chrome.browsingData.remove(options, dataType);
}

async function clearSiteData(origins, config) {
  const tasks = [];
  const isAllUrls = origins.length === 1 && origins[0] === '<all_urls>';
  const forAll = { origins: ['<all_urls>'] };

  if (config.clearLocalStorage) {
    tasks.push(clearBrowsingData({ localStorage: true }, isAllUrls ? forAll.origins : origins));
  }
  if (config.clearSessionStorage) {
    tasks.push(clearBrowsingData({ sessionStorage: true }, isAllUrls ? forAll.origins : origins));
  }
  if (config.clearIndexedDB) {
    if (isAllUrls) {
      tasks.push(clearBrowsingData({ indexedDB: true }, forAll.origins));
    } else {
      for (const origin of origins) {
        tasks.push(clearBrowsingData({ indexedDB: true }, [origin]));
      }
    }
  }
  if (config.clearCookies) {
    tasks.push(clearBrowsingData({ cookies: true }, isAllUrls ? forAll.origins : origins));
  }
  if (config.clearCache) {
    tasks.push(clearBrowsingData({ cacheStorage: true }, isAllUrls ? forAll.origins : origins));
  }

  const results = await Promise.allSettled(tasks);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn('[SiteCleaner] Some cleanup tasks failed:', failures.map(f => f.reason));
  }
}

async function runCleanup() {
  const config = await getConfig();
  if (!config.enabled) return;

  const origins = originsToClean(config);

  try {
    await clearSiteData(origins, config);
    console.log(`[SiteCleaner] Cleared data for ${origins.length > 1 ? 'all URLs' : origins[0]}`);
  } catch (err) {
    console.error('[SiteCleaner] Cleanup failed:', err);
  }
}

async function scheduleAlarm(config) {
  await chrome.alarms.clear('siteCleanup');
  if (config.enabled) {
    chrome.alarms.create('siteCleanup', { periodInMinutes: config.intervalMinutes });
  }
}

async function applyWebRTCPolicy(config) {
  const policy = config.webrtcPolicy || 'default';
  if (!chrome.privacy?.network?.webRTCIPHandlingPolicy) {
    return; // Not available (Firefox, older Chrome, or missing permission) — no-op
  }
  try {
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({ value: policy });
    console.log(`[SiteCleaner] WebRTC IP handling policy set to '${policy}'`);
  } catch (err) {
    console.warn('[SiteCleaner] Failed to apply WebRTC IP handling policy:', err);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'siteCleanup') {
    runCleanup();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  await applyWebRTCPolicy(config);
  if (config.enabled) {
    await scheduleAlarm(config);
    runCleanup();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'runCleanupNow') {
    runCleanup().then(() => sendResponse({ success: true }));
    return true;
  }
  if (message.type === 'updateConfig') {
    saveConfig(message.config).then(async () => {
      await applyWebRTCPolicy(message.config);
      await scheduleAlarm(message.config);
      chrome.tabs.query({}, tabs => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'themeChanged', theme: message.config.theme }).catch(() => {});
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.type === 'getConfig') {
    getConfig().then(c => sendResponse(c));
    return true;
  }
});
