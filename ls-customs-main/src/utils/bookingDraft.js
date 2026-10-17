import { readJSON, writeJSON, removeKey } from './storage.js';

// In-progress booking wizard state, kept in sessionStorage PER customer
// account so a refresh/navigation doesn't lose it and two accounts on one
// browser never see each other's draft. Only choices are stored — never
// prices (those always come from serviceData.js).
function keyFor(email) {
  return 'lsc_booking_draft:' + String(email || '').toLowerCase();
}

export function loadDraft(email) {
  if (!email) return null;
  var d = readJSON('session', keyFor(email), null);
  return d && typeof d === 'object' ? d : null;
}

export function saveDraft(email, draft) {
  if (!email) return;
  writeJSON('session', keyFor(email), draft);
}

export function clearDraft(email) {
  if (!email) return;
  removeKey('session', keyFor(email));
}
