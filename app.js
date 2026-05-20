/* ================================================
   CRYPTID X DECODER — app.js
   ================================================
   DECRYPTION ALGORITHM (clearly marked below):
   1. Fetch JSON from GitHub raw URL using the Script ID
   2. Extract "Key" and "Script" fields from JSON
   3. Base32-decode the "Script" field (standard RFC 4648 alphabet: A-Z + 2-7)
   4. XOR each decoded byte with the Key bytes cyclically
   5. Interpret the result as UTF-8 text = the Lua script
   ================================================ */

'use strict';

/* ─── DOM refs ─────────────────────────────────────── */
const scriptInput   = document.getElementById('scriptInput');
const decryptBtn    = document.getElementById('decryptBtn');
const clearBtn      = document.getElementById('clearBtn');
const pasteBtn      = document.getElementById('pasteBtn');
const loaderWrap    = document.getElementById('loaderWrap');
const loaderBar     = document.getElementById('loaderBar');
const errorAlert    = document.getElementById('errorAlert');
const errorMsg      = document.getElementById('errorMsg');
const outputPanel   = document.getElementById('outputPanel');
const outputMeta    = document.getElementById('outputMeta');
const codeContent   = document.getElementById('codeContent');
const copyBtn       = document.getElementById('copyBtn');
const downloadBtn   = document.getElementById('downloadBtn');
const historyList   = document.getElementById('historyList');
const clearHistBtn  = document.getElementById('clearHistoryBtn');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');

/* Step elements */
const steps = [
  document.getElementById('step1'),
  document.getElementById('step2'),
  document.getElementById('step3'),
  document.getElementById('step4'),
];

/* ─── State ────────────────────────────────────────── */
let currentScript = '';
let currentId     = '';

/* ─── History (localStorage) ───────────────────────── */
const HISTORY_KEY = 'cryptid_history';
const MAX_HISTORY = 10;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function addHistoryEntry(id, size, date) {
  const items = loadHistory();
  const existing = items.findIndex(i => i.id === id);
  if (existing !== -1) items.splice(existing, 1);
  items.unshift({ id, size, date, ts: Date.now() });
  if (items.length > MAX_HISTORY) items.splice(MAX_HISTORY);
  saveHistory(items);
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  if (!items.length) {
    historyList.innerHTML = '<p class="empty-state">No decryptions yet. Paste a link above to get started.</p>';
    return;
  }
  historyList.innerHTML = items.map(item => `
    <div class="history-item" data-id="${escHtml(item.id)}">
      <div class="history-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
      </div>
      <div class="history-info">
        <div class="history-id">${escHtml(item.id)}</div>
        <div class="history-meta">${escHtml(item.date)} · ${formatBytes(item.size)}</div>
      </div>
      <button class="history-action" data-id="${escHtml(item.id)}">LOAD</button>
    </div>
  `).join('');

  /* Click on item row → fill input */
  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      scriptInput.value = el.dataset.id;
    });
  });

  /* LOAD button → fill and run */
  historyList.querySelectorAll('.history-action').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      scriptInput.value = btn.dataset.id;
      runDecrypt();
    });
  });
}

/* ─── Utility ──────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── Extract Script ID ────────────────────────────── */
function extractId(raw) {
  raw = raw.trim();
  if (!raw) return null;

  /* Full URL with ?Id= */
  try {
    const url = new URL(raw);
    const id = url.searchParams.get('Id') || url.searchParams.get('id') || url.searchParams.get('ID');
    if (id) return id.trim();
  } catch { /* not a URL, fall through */ }

  /* Bare ID (numbers, letters, hyphens, underscores) */
  if (/^[\w\-]+$/.test(raw)) return raw;

  /* URL-like but not parseable — try regex */
  const m = raw.match(/[?&]Id=([^&\s]+)/i);
  if (m) return m[1].trim();

  return null;
}

/* ─── GITHUB FETCH ─────────────────────────────────── */
async function fetchScriptData(id) {
  /* Construct raw GitHub URL */
  const url = `https://raw.githubusercontent.com/ScriptObfuscator2/Scripts/main/${encodeURIComponent(id)}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (response.status === 404) throw new Error(`Script ID "${id}" not found on GitHub. Check that the ID is correct.`);
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}. Try again later.`);

  const text = await response.text();

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('Response from GitHub is not valid JSON. The file may be malformed.'); }

  if (!json.Key || !json.Script) {
    throw new Error('JSON is missing required "Key" or "Script" fields.');
  }

  return json;
}

/* ════════════════════════════════════════════════════
   DECRYPTION ALGORITHM
   ════════════════════════════════════════════════════
   Step 1 — Base32 decode
     Standard RFC 4648 alphabet: A-Z (0-25) + 2-7 (26-31)
     Groups of 8 chars → 5 bytes (40 bits)
   Step 2 — XOR with key
     For each decoded byte at index i:
       output[i] = decoded[i] XOR key[i % key.length]
   Result interpreted as UTF-8 text = Lua source
   ════════════════════════════════════════════════════ */
function base32Decode(input) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  input = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');

  const output = [];
  let buffer = 0;
  let bitsLeft = 0;

  for (let i = 0; i < input.length; i++) {
    const charIdx = ALPHABET.indexOf(input[i]);
    if (charIdx === -1) {
      throw new Error(`Invalid Base32 character: "${input[i]}" at position ${i}`);
    }
    buffer = (buffer << 5) | charIdx;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      output.push((buffer >>> bitsLeft) & 0xFF);
    }
  }

  return new Uint8Array(output);
}

function xorDecrypt(data /* Uint8Array */, key /* string */) {
  const keyBytes = new TextEncoder().encode(key);
  const result   = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder('utf-8').decode(result);
}

function decrypt(scriptField, keyField) {
  const decoded  = base32Decode(scriptField);
  return xorDecrypt(decoded, keyField);
}

/* ─── UI helpers ───────────────────────────────────── */
function setStatus(state, label) {
  statusDot.className   = 'status-dot' + (state ? ' ' + state : '');
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
  /* state: 'active' | 'done' */
  if (idx > 0) steps[idx - 1].className = 'step done';
  steps[idx].className = 'step ' + state;
  loaderBar.style.width = ((idx + 1) / steps.length * 100) + '%';
}

function setLoading(on) {
  loaderWrap.hidden = !on;
  decryptBtn.disabled = on;
  if (!on) { resetSteps(); loaderBar.style.width = '0%'; }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── Main decrypt flow ────────────────────────────── */
async function runDecrypt() {
  const raw = scriptInput.value;
  hideError();
  outputPanel.hidden = true;

  /* Extract ID */
  const id = extractId(raw);
  if (!id) {
    showError('Could not extract a valid Script ID. Paste the full Encrypt X URL or just the numeric ID.');
    return;
  }

  currentId = id;
  setStatus('busy', 'WORKING');
  setLoading(true);

  try {
    /* Step 1 */
    setStep(0, 'active');
    await delay(200);
    setStep(0, 'done');

    /* Step 2 — fetch */
    setStep(1, 'active');
    const data = await fetchScriptData(id);
    setStep(1, 'done');

    /* Step 3 — decrypt */
    setStep(2, 'active');
    await delay(80); /* brief pause so user can see the step */
    let lua;
    try {
      lua = decrypt(data.Script, data.Key);
    } catch (e) {
      throw new Error('Decryption failed: ' + e.message);
    }
    if (!lua || lua.trim().length === 0) {
      throw new Error('Decryption produced empty output. The script may use a different algorithm.');
    }
    setStep(2, 'done');

    /* Step 4 — render */
    setStep(3, 'active');
    await delay(60);

    currentScript = lua;

    /* Meta */
    outputMeta.innerHTML = `
      <div class="meta-chip">
        <span class="meta-label">SCRIPT ID</span>
        <span class="meta-value">${escHtml(id)}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">DATE</span>
        <span class="meta-value">${escHtml(data.Date || 'N/A')}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">SIZE</span>
        <span class="meta-value">${formatBytes(new TextEncoder().encode(lua).length)}</span>
      </div>
      <div class="meta-chip">
        <span class="meta-label">LINES</span>
        <span class="meta-value">${lua.split('\n').length.toLocaleString()}</span>
      </div>
    `;

    /* Code preview */
    codeContent.textContent = lua;

    setStep(3, 'done');

    outputPanel.hidden = false;
    outputPanel.classList.add('panel-reveal');
    outputPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    /* Save to history */
    addHistoryEntry(id, new TextEncoder().encode(lua).length, data.Date || 'N/A');

    setStatus('', 'READY');

  } catch (err) {
    showError(err.message || 'Unknown error occurred.');
    setStatus('error', 'ERROR');
  } finally {
    setLoading(false);
  }
}

/* ─── Copy to clipboard ────────────────────────────── */
async function copyToClipboard() {
  if (!currentScript) return;
  try {
    await navigator.clipboard.writeText(currentScript);
    copyBtn.classList.add('success');
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20,6 9,17 4,12"/></svg>
      <span>COPIED!</span>
    `;
    setTimeout(() => {
      copyBtn.classList.remove('success');
      copyBtn.innerHTML = orig;
    }, 2000);
  } catch {
    /* Fallback */
    const ta = document.createElement('textarea');
    ta.value = currentScript;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/* ─── Download .lua ────────────────────────────────── */
function downloadLua() {
  if (!currentScript || !currentId) return;
  const filename = `${currentId}_decrypted.lua`;
  const blob = new Blob([currentScript], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ─── Clear ────────────────────────────────────────── */
function clearAll() {
  scriptInput.value = '';
  outputPanel.hidden = true;
  hideError();
  currentScript = '';
  currentId = '';
  setStatus('', 'READY');
  scriptInput.focus();
}

/* ─── Event listeners ──────────────────────────────── */
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
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

/* ─── Init ─────────────────────────────────────────── */
renderHistory();
