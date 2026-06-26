function el(id) { return document.getElementById(id); }

async function loadConfig() {
  const resp = await chrome.runtime.sendMessage({ type: 'getConfig' });
  el('enabled').checked = resp.enabled;
  el('intervalMinutes').value = resp.intervalMinutes;
  el('clearLocalStorage').checked = resp.clearLocalStorage;
  el('clearSessionStorage').checked = resp.clearSessionStorage;
  el('clearIndexedDB').checked = resp.clearIndexedDB;
  el('clearCookies').checked = resp.clearCookies;
  el('clearCache').checked = resp.clearCache;
  el('matchAllUrls').checked = resp.matchAllUrls;
  el('origins').value = (resp.origins || []).join('\n');
  updateUI(resp);
}

function updateUI(config) {
  el('statusBadge').textContent = config.enabled ? 'On' : 'Off';
  el('statusBadge').style.color = config.enabled ? '#4fc3f7' : '#888';
  el('customOriginsRow').style.display = config.matchAllUrls ? 'none' : 'flex';
}

el('matchAllUrls').addEventListener('change', () => {
  el('customOriginsRow').style.display = el('matchAllUrls').checked ? 'none' : 'flex';
});

function collectConfig() {
  return {
    enabled: el('enabled').checked,
    intervalMinutes: parseInt(el('intervalMinutes').value) || 60,
    clearLocalStorage: el('clearLocalStorage').checked,
    clearSessionStorage: el('clearSessionStorage').checked,
    clearIndexedDB: el('clearIndexedDB').checked,
    clearCookies: el('clearCookies').checked,
    clearCache: el('clearCache').checked,
    matchAllUrls: el('matchAllUrls').checked,
    origins: el('origins').value.split('\n').map(s => s.trim()).filter(Boolean),
  };
}

el('saveBtn').addEventListener('click', async () => {
  const config = collectConfig();
  await chrome.runtime.sendMessage({ type: 'updateConfig', config });
  updateUI(config);
  showStatus('Saved ✓', '#4fc3f7');
});

el('cleanNowBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'runCleanupNow' });
  showStatus('Cleaned ✓', '#81c784');
});

function showStatus(msg, color) {
  const s = el('status');
  s.textContent = msg;
  s.style.color = color;
  setTimeout(() => { s.textContent = ''; }, 2000);
}

loadConfig();
