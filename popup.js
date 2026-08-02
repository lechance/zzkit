function el(id) { return document.getElementById(id); }

let currentTheme = 'system';

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
  updateUI(resp);
  currentTheme = resp.theme || 'system';
  applyTheme(currentTheme);
}

function updateUI(config) {
  el('statusBadge').textContent = config.enabled ? 'On' : 'Off';
  el('statusBadge').className = 'badge' + (config.enabled ? ' badge-on' : '');
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
    theme: currentTheme,
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

el('themeToggle').addEventListener('click', async () => {
  const resp = await chrome.runtime.sendMessage({ type: 'getConfig' });
  const cycle = { system: 'dark', dark: 'light', light: 'off', off: 'system' };
  const next = cycle[resp.theme] || 'system';
  await chrome.runtime.sendMessage({ type: 'updateConfig', config: { ...resp, theme: next } });
  applyTheme(next);
});

function applyTheme(theme) {
  currentTheme = theme;
  const root = document.documentElement;
  root.classList.remove('force-dark', 'force-light');
  if (theme === 'dark') root.classList.add('force-dark');
  else if (theme === 'light') root.classList.add('force-light');

  const btn = el('themeToggle');
  const labels = { system: 'Auto', dark: '☾ Dark', light: '☀ Light', off: '✕ Off' };
  btn.textContent = labels[theme] || 'Auto';
}

function showStatus(msg, color) {
  const s = el('status');
  s.textContent = msg;
  s.style.color = color;
  setTimeout(() => { s.textContent = ''; }, 2000);
}

loadConfig();
