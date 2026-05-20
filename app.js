/* ================================================
   CRYPTID X DECODER v2.0 — Main Application
   ================================================ */

'use strict';

/* ─── Initialize Storage & Managers ────────────────── */
const storage = new StorageManager();
const requestManager = new RequestManager(3, 10000);

/* ─── DOM Elements ──────────────────────────────────– */
// Header
const themeToggle = document.getElementById('themeToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Decrypt Tab
const scriptInput = document.getElementById('scriptInput');
const decryptBtn = document.getElementById('decryptBtn');
const clearBtn = document.getElementById('clearBtn');
const pasteBtn = document.getElementById('pasteBtn');
const loaderWrap = document.getElementById('loaderWrap');
const loaderBar = document.getElementById('loaderBar');
const errorAlert = document.getElementById('errorAlert');
const errorMsg = document.getElementById('errorMsg');
const outputPanel = document.getElementById('outputPanel');
const outputMeta = document.getElementById('outputMeta');
const codeContent = document.getElementById('codeContent');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const historyList = document.getElementById('historyList');
const clearHistBtn = document.getElementById('clearHistoryBtn');
const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
  document.getElementById('step4'),
];

// Batch Tab
const batchInput = document.getElementById('batchInput');
const batchDecryptBtn = document.getElementById('batchDecryptBtn');
const batchClearBtn = document.getElementById('batchClearBtn');
const batchProgress = document.getElementById('batchProgress');
const batchProgressFill = document.getElementById('batchProgressFill');
const progressStatus = document.getElementById('progressStatus');
const batchResultsPanel = document.getElementById('batchResultsPanel');
const batchResults = document.getElementById('batchResults');
const exportBatchBtn = document.getElementById('exportBatchBtn');

// Settings Tab
const autoScroll = document.getElementById('autoScroll');
const syntaxHighlight = document.getElementById('syntaxHighlight');
const enableNotifications = document.getElementById('enableNotifications');
const historyLimit = document.getElementById('historyLimit');
const historyLimitValue = document.getElementById('historyLimitValue');
const clearAllDataBtn = document.getElementById('clearAllDataBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataBtn = document.getElementById('importDataBtn');
const importFile = document.getElementById('importFile');
const themeAuto = document.getElementById('themeAuto');
const themeDark = document.getElementById('themeDark');
const themeLight = document.getElementById('themeLight');

/* ─── State ────────────────────────────────────────– */
let currentScript = '';
let currentId = '';
let batchResults_data = [];

/* ─── Theme Management ─────────────────────────────– */
function initTheme() {
  const saved = storage.get('theme', 'auto');
  applyTheme(saved);
  if (saved === 'auto') themeAuto.checked = true;
  else if (saved === 'dark') themeDark.checked = true;
  else if (saved === 'light') themeLight.checked = true;
}

function applyTheme(theme) {
  if (theme === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('light-mode', !isDark);
  } else if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  storage.set('theme', theme);
}

/* ─── Settings Management ──────────────────────────– */
function loadSettings() {
  const settings = storage.get('settings', {
    autoScroll: true,
    syntaxHighlight: true,
    enableNotifications: false,
    historyLimit: 10
  });

  autoScroll.checked = settings.autoScroll;
  syntaxHighlight.checked = settings.syntaxHighlight;
  enableNotifications.checked = settings.enableNotifications;
  historyLimit.value = settings.historyLimit;
  historyLimitValue.textContent = settings.historyLimit;

  if (enableNotifications.checked && 'Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

function saveSettings() {
  storage.set('settings', {
    autoScroll: autoScroll.checked,
    syntaxHighlight: syntaxHighlight.checked,
    enableNotifications: enableNotifications.checked,
    historyLimit: parseInt(historyLimit.value)
  });
}

/* ─── Tab Navigation ───────────────────────────────– */
function initTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`tab-${tabName}`)?.classList.add('active');
    });
  });
}

/* ─── History Management ───────────────────────────– */
function loadHistory() {
  const settings = storage.get('settings', { historyLimit: 10 });
  return storage.get('history', []).slice(0, settings.historyLimit);
}

function saveHistory(items) {
  const settings = storage.get('settings', { historyLimit: 10 });
  storage.set('history', items.slice(0, settings.historyLimit));
}

function addHistoryEntry(id, size, date) {
  const items = loadHistory();
  const existing = items.findIndex(i => i.id === id);
  if (existing !== -1) items.splice(existing, 1);
  items.unshift({ id, size, date, ts: Date.now() });
  saveHistory(items);
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  if (!items.length) {
    historyList.innerHTML = '<p class="empty-state">No decryptions yet. Start decrypting!</p>';
    return;
  }

  historyList.innerHTML = items.map(item => `
    <div class="history-item" data-id="${CryptidUtils.escapeHtml(item.id)}">
      <div class="history-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
      </div>
      <div class="history-info">
        <div class="history-id">${CryptidUtils.escapeHtml(item.id)}</div>
        <div class="history-meta">${CryptidUtils.formatDate(item.ts)} · ${CryptidUtils.formatBytes(item.size)}</div>
      </div>
      <button class="history-action" data-id="${CryptidUtils.escapeHtml(item.id)}">LOAD</button>
    </div>
  `).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      scriptInput.value = el.dataset.id;
    });
  });

  historyList.querySelectorAll('.history-action').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      scriptInput.value = btn.dataset.id;
      runDecrypt();
    });
  });
}

/* ─── UI Helpers ────────────────────────────────────– */
function setStatus(state, label) {
  statusDot.className = 'status-dot' + (state ? ' ' + state : '');
  statusText.textContent = label;
}

function showError(msg) {
  errorAlert.hidden = false;
  errorMsg.textContent = msg;
  setStatus('error', 'ERROR');
}

function hideError() {
  errorAlert.hidden = true;
}

function resetSteps() {
  steps.forEach(s => { s.className = 'step'; });
}

function setStep(idx, state) {
  if (idx > 0) steps[idx - 1].className = 'step done';
  steps[idx].className = 'step ' + state;
  loaderBar.style.width = ((idx + 1) / steps.length * 100) + '%';
}

function setLoading(on) {
  loaderWrap.hidden = !on;
  decryptBtn.disabled = on;
  if (!on) { resetSteps(); loaderBar.style.width = '0%'; }
}

/* ─── Single Decryption ────────────────────────────– */
async function runDecrypt() {
  const raw = scriptInput.value;
  hideError();
  outputPanel.hidden = true;

  const id = CryptidUtils.extractId(raw);
  if (!id) {
    showError('Invalid Script ID or URL format.');
    return;
  }

  currentId = id;
  setStatus('busy', 'WORKING');
  setLoading(true);

  try {
    setStep(0, 'active');
    await CryptidUtils.delay(200);
    setStep(0, 'done');

    setStep(1, 'active');
    const data = await fetchScriptData(id, requestManager);
    setStep(1, 'done');

    setStep(2, 'active');
    await CryptidUtils.delay(80);
    let lua;
    try {
      lua = decrypt(data.Script, data.Key);
    } catch (e) {
      throw new Error('Decryption failed: ' + e.message);
    }
    if (!lua || lua.trim().length === 0) {
      throw new Error('Decryption produced empty output.');
    }
    setStep(2, 'done');

    setStep(3, 'active');
    await CryptidUtils.delay(60);

    currentScript = lua;

    outputMeta.innerHTML = `
      <div class="meta-chip">
        <span class="meta-label">SCRIPT ID</span>
        <span class="meta-value">${CryptidUtils.escapeHtml(id)}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">DATE</span>
        <span class="meta-value">${CryptidUtils.escapeHtml(data.Date || 'N/A')}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">SIZE</span>
        <span class="meta-value">${CryptidUtils.formatBytes(new TextEncoder().encode(lua).length)}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">LINES</span>
        <span class="meta-value">${lua.split('\n').length.toLocaleString()}</span>
      </div>
    `;

    codeContent.textContent = lua;

    setStep(3, 'done');

    outputPanel.hidden = false;
    outputPanel.classList.add('panel-reveal');
    
    if (autoScroll.checked) {
      outputPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    addHistoryEntry(id, new TextEncoder().encode(lua).length, data.Date || 'N/A');

    setStatus('', 'READY');

    const settings = storage.get('settings', {});
    if (settings.enableNotifications) {
      CryptidUtils.showNotification('✓ Script Decrypted', { body: `ID: ${id}` });
    }

  } catch (err) {
    showError(err.message || 'Unknown error.');
    setStatus('error', 'ERROR');
  } finally {
    setLoading(false);
  }
}

/* ─── Batch Decryption ─────────────────────────────– */
async function runBatchDecrypt() {
  const input = batchInput.value.trim();
  if (!input) {
    showError('Paste at least one Script ID.');
    return;
  }

  const ids = input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => CryptidUtils.extractId(line))
    .filter(id => id !== null);

  if (ids.length === 0) {
    showError('No valid Script IDs found.');
    return;
  }

  batchResults_data = [];
  batchProgress.hidden = false;
  batchResultsPanel.hidden = true;
  batchDecryptBtn.disabled = true;

  const startTime = Date.now();

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const progress = ((i + 1) / ids.length * 100);
    batchProgressFill.style.width = progress + '%';
    progressStatus.textContent = `${i + 1}/${ids.length} completed`;

    try {
      const data = await fetchScriptData(id, requestManager);
      const lua = decrypt(data.Script, data.Key);

      batchResults_data.push({
        id,
        success: true,
        size: new TextEncoder().encode(lua).length,
        date: data.Date || 'N/A',
        message: 'Successfully decrypted'
      });
    } catch (err) {
      batchResults_data.push({
        id,
        success: false,
        message: err.message || 'Unknown error'
      });
    }

    if (i < ids.length - 1) {
      await CryptidUtils.delay(200);
    }
  }

  displayBatchResults();
  batchProgress.hidden = true;
  batchDecryptBtn.disabled = false;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = batchResults_data.filter(r => r.success).length;

  CryptidUtils.showNotification(`✓ Batch Complete`, {
    body: `${successCount}/${ids.length} succeeded in ${elapsed}s`
  });
}

function displayBatchResults() {
  batchResults.innerHTML = batchResults_data.map((result, idx) => `
    <div class="batch-result-item ${result.success ? 'success' : 'error'}">
      <div class="result-icon ${result.success ? 'success' : 'error'}">
        ${result.success ? '✓' : '✕'}
      </div>
      <div class="result-info">
        <div class="result-id">${CryptidUtils.escapeHtml(result.id)}</div>
        <div class="result-msg">
          ${result.success 
            ? `${CryptidUtils.formatBytes(result.size)} · ${result.date}` 
            : result.message}
        </div>
      </div>
    </div>
  `).join('');

  batchResultsPanel.hidden = false;
}

/* ─── Copy & Download ──────────────────────────────– */
async function copyToClipboard() {
  if (!currentScript) return;
  const success = await CryptidUtils.copyToClipboard(currentScript);
  if (success) {
    copyBtn.classList.add('success');
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg><span>COPIED!</span>';
    setTimeout(() => {
      copyBtn.classList.remove('success');
      copyBtn.innerHTML = orig;
    }, 2000);
  }
}

function downloadLua() {
  if (!currentScript || !currentId) return;
  CryptidUtils.downloadFile(currentScript, `${currentId}_decrypted.lua`);
}

function downloadBatchResults() {
  const json = JSON.stringify(batchResults_data, null, 2);
  CryptidUtils.downloadFile(json, 'batch_results.json');
}

/* ─── Data Management ──────────────────────────────– */
function exportData() {
  const data = {
    settings: storage.get('settings'),
    history: loadHistory(),
    exportedAt: new Date().toISOString()
  };
  CryptidUtils.downloadFile(JSON.stringify(data, null, 2), 'cryptid_data.json');
}

function importData() {
  importFile.click();
}

importFile.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.settings) storage.set('settings', data.settings);
      if (data.history) storage.set('history', data.history);
      loadSettings();
      renderHistory();
      alert('Data imported successfully!');
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
  importFile.value = '';
});

function clearAllData() {
  if (!confirm('Are you sure? This will delete all history and reset settings.')) return;
  storage.clear();
  loadSettings();
  renderHistory();
  alert('All data cleared.');
}

/* ─── Clear Functions ──────────────────────────────– */
function clearAll() {
  scriptInput.value = '';
  outputPanel.hidden = true;
  hideError();
  currentScript = '';
  currentId = '';
  setStatus('', 'READY');
  scriptInput.focus();
}

function clearBatch() {
  batchInput.value = '';
  batchProgress.hidden = true;
  batchResultsPanel.hidden = true;
  batchResults_data = [];
}

/* ─── Event Listeners ──────────────────────────────– */
function initEventListeners() {
  // Theme
  themeToggle.addEventListener('click', () => {
    const current = storage.get('theme', 'auto');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  themeAuto.addEventListener('change', () => applyTheme('auto'));
  themeDark.addEventListener('change', () => applyTheme('dark'));
  themeLight.addEventListener('change', () => applyTheme('light'));

  // Decrypt Tab
  decryptBtn.addEventListener('click', runDecrypt);
  clearBtn.addEventListener('click', clearAll);
  copyBtn.addEventListener('click', copyToClipboard);
  downloadBtn.addEventListener('click', downloadLua);
  
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      scriptInput.value = text.trim();
      scriptInput.focus();
    } catch {
      scriptInput.focus();
    }
  });

  scriptInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') runDecrypt();
  });

  clearHistBtn.addEventListener('click', () => {
    storage.set('history', []);
    renderHistory();
  });

  // Batch Tab
  batchDecryptBtn.addEventListener('click', runBatchDecrypt);
  batchClearBtn.addEventListener('click', clearBatch);
  exportBatchBtn.addEventListener('click', downloadBatchResults);

  // Settings Tab
  [autoScroll, syntaxHighlight, enableNotifications].forEach(el => {
    el.addEventListener('change', saveSettings);
  });

  historyLimit.addEventListener('input', e => {
    historyLimitValue.textContent = e.target.value;
    saveSettings();
  });

  enableNotifications.addEventListener('change', e => {
    if (e.target.checked && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  });

  clearAllDataBtn.addEventListener('click', clearAllData);
  exportDataBtn.addEventListener('click', exportData);
  importDataBtn.addEventListener('click', importData);
}

/* ─── Initialization ───────────────────────────────– */
function init() {
  initTheme();
  initTabs();
  loadSettings();
  renderHistory();
  initEventListeners();
  setStatus('', 'READY');
}

document.addEventListener('DOMContentLoaded', init);
