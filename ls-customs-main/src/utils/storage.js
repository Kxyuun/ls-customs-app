// Small guarded wrappers around Web Storage plus a tiny change-notification
// bus, so React can re-render when localStorage changes in THIS tab (custom
// event) or in ANOTHER tab (the native `storage` event).
var CHANGE_EVENT = 'lsc:storage-change';

function getStore(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch (e) {
    return null;
  }
}

export function readRaw(kind, key) {
  var store = getStore(kind);
  if (!store) return null;
  try { return store.getItem(key); } catch (e) { return null; }
}

export function readJSON(kind, key, fallback) {
  var raw = readRaw(kind, key);
  if (raw === null || raw === undefined) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

export function writeJSON(kind, key, value) {
  var store = getStore(kind);
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    emitStorageChange();
    return true;
  } catch (e) {
    return false;
  }
}

export function removeKey(kind, key) {
  var store = getStore(kind);
  if (!store) return;
  try { store.removeItem(key); } catch (e) { /* ignore */ }
  emitStorageChange();
}

export function emitStorageChange() {
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch (e) { /* ignore */ }
}

export function subscribeStorage(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return function () {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function makeId(prefix) {
  try {
    if (window.crypto && window.crypto.randomUUID) return prefix + '_' + window.crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
