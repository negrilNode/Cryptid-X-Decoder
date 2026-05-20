/* ================================================
   CRYPTID X DECODER v2.0 — Utility Functions
   ================================================ */

'use strict';

/* ─── Storage Manager ──────────────────────────────── */
class StorageManager {
  constructor() {
    this.prefix = 'cryptid_';
  }

  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Storage full or unavailable:', e);
      return false;
    }
  }

  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(this.prefix + key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      console.warn('Failed to parse storage:', e);
      return defaultValue;
    }
  }

  remove(key) {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}

/* ─── Request Manager ──────────────────────────────– */
class RequestManager {
  constructor(maxRetries = 3, timeout = 10000) {
    this.maxRetries = maxRetries;
    this.timeout = timeout;
  }

  async fetch(url, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          cache: 'no-store'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response;
      } catch (e) {
        lastError = e;
        if (attempt < this.maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }
    throw lastError || new Error('Request failed');
  }
}

/* ─── Utility Functions ────────────────────────────– */
class CryptidUtils {
  /* HTML Escaping */
  static escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Formatting */
  static formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  static formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /* ID Extraction */
  static extractId(raw) {
    raw = raw.trim();
    if (!raw) return null;

    try {
      const url = new URL(raw);
      const id = url.searchParams.get('Id') || url.searchParams.get('id') || url.searchParams.get('ID');
      if (id) return id.trim();
    } catch { /* not a URL */ }

    if (/^[\w\-]+$/.test(raw)) return raw;

    const m = raw.match(/[?&]Id=([^&\s]+)/i);
    if (m) return m[1].trim();

    return null;
  }

  /* Delay Helper */
  static delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* Clipboard */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.select();
      const success = document.execCommand('copy');
      document.body.removeChild(ta);
      return success;
    }
  }

  /* File Download */
  static downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* Notifications */
  static showNotification(title, options = {}) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }
}

/* ─── Decryption Engine ────────────────────────────– */

/* Base32 Decode (RFC 4648) */
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

/* XOR Decrypt */
function xorDecrypt(data, key) {
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder('utf-8').decode(result);
}

/* Combined Decryption */
function decrypt(scriptField, keyField) {
  const decoded = base32Decode(scriptField);
  return xorDecrypt(decoded, keyField);
}

/* Fetch Script Data */
async function fetchScriptData(id, requestManager) {
  const url = `https://raw.githubusercontent.com/ScriptObfuscator2/Scripts/main/${encodeURIComponent(id)}`;
  const response = await requestManager.fetch(url);

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Response from GitHub is not valid JSON.');
  }

  if (!json.Key || !json.Script) {
    throw new Error('JSON is missing required "Key" or "Script" fields.');
  }

  return json;
}

/* ─── Particle Animation ────────────────────────────– */
function initParticles() {
  const container = document.querySelector('.particle-bg');
  if (!container) return;

  const particleCount = 15;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 5 + 's';
    fragment.appendChild(particle);
  }

  container.appendChild(fragment);
}

document.addEventListener('DOMContentLoaded', initParticles);
