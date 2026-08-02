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
  el('webrtcPolicy').value = resp.webrtcPolicy || 'default';
  el('darkModeSwitch').checked = !!resp.darkMode;
  updateUI(resp);
  applyDarkMode(el('darkModeSwitch').checked);
}

function updateUI(config) {
  el('statusBadge').textContent = config.enabled ? 'On' : 'Off';
  el('statusBadge').className = 'badge' + (config.enabled ? ' badge-on' : '');
  el('customOriginsRow').style.display = config.matchAllUrls ? 'none' : 'flex';
}

el('matchAllUrls').addEventListener('change', () => {
  el('customOriginsRow').style.display = el('matchAllUrls').checked ? 'none' : 'flex';
});

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === name);
  });
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

switchTab('theme');

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
    darkMode: el('darkModeSwitch').checked,
    webrtcPolicy: el('webrtcPolicy').value,
  };
}

el('saveBtn').addEventListener('click', async () => {
  const config = collectConfig();
  await chrome.runtime.sendMessage({ type: 'updateConfig', config });
  updateUI(config);
  showStatus('Saved ✓', 'var(--accent)');
});

el('cleanNowBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'runCleanupNow' });
  showStatus('Cleaned ✓', '#81c784');
});

el('darkModeSwitch').addEventListener('change', async () => {
  applyDarkMode(el('darkModeSwitch').checked);
  await chrome.runtime.sendMessage({ type: 'updateConfig', config: collectConfig() });
});

function applyDarkMode(on) {
  document.documentElement.classList.toggle('force-dark', !!on);
  document.documentElement.classList.toggle('force-light', !on);
}

function showStatus(msg, color) {
  const s = el('status');
  s.textContent = msg;
  s.style.color = color;
  setTimeout(() => { s.textContent = ''; }, 2000);
}

loadConfig();
