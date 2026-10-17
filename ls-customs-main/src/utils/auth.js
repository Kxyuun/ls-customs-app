import { API } from '../config/api.js';
import { apiRequest, ApiError } from './api.js';
import { readJSON, readRaw, writeJSON, removeKey, makeId, subscribeStorage } from './storage.js';
import { normalizeEmail, normalizeName } from './validation.js';
import { clearDraft } from './bookingDraft.js';
import { useMemo, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// DEMO-ONLY auth. There is no backend, so accounts live in localStorage on
// this browser. Passwords are salted + SHA-256 hashed before storing, but that
// is NOT real security: anyone with access to the browser profile can read or
// edit this data. When API.* endpoints are set, login/registration go to the
// server instead and the local account store is not used.
// ---------------------------------------------------------------------------

var CUSTOMER_ACCOUNTS_KEY = 'lsc_customer_accounts';
var CUSTOMER_SESSION_KEY = 'lsc_customer_session';
var STAFF_ACCOUNTS_KEY = 'lsc_staff_accounts';
var STAFF_SESSION_KEY = 'lsc_staff_session';

// Keys written by the earlier global-identity implementation. Removed so a
// previous user's name can never leak into a new session.
var LEGACY_KEYS = [
  'lsc_customer_logged_in', 'lsc_customer_email',
  'lsc_customer_first_name', 'lsc_customer_last_name',
  'lsc_token', 'lsc_role'
];
LEGACY_KEYS.forEach(function (k) { removeKey('local', k); });

var STORAGE_UNAVAILABLE = 'Storage unavailable';

// writeJSON reports failure by returning false (blocked/full/disabled storage).
// Session-start code must never ignore that, or the caller would think it is
// signed in when no session exists.
function requireWrite(ok) {
  if (!ok) throw new ApiError(STORAGE_UNAVAILABLE, 0);
}

async function hashPassword(password, salt) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('SECURE_CONTEXT_REQUIRED');
  }
  var data = new TextEncoder().encode(salt + ':' + password);
  var digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.prototype.map.call(new Uint8Array(digest), function (b) {
    return ('0' + b.toString(16)).slice(-2);
  }).join('');
}

export function authErrorMessage(err, fallback) {
  if (err && err.message === 'SECURE_CONTEXT_REQUIRED') {
    return 'This browser context cannot secure the demo login. Open the site on localhost or HTTPS.';
  }
  if (err && err.message === STORAGE_UNAVAILABLE) {
    return 'Could not save your session. Check that browser storage is enabled.';
  }
  return fallback;
}

// ------------------------------- customers ---------------------------------
function readCustomerAccounts() {
  var list = readJSON('local', CUSTOMER_ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function findCustomerAccount(email) {
  var e = normalizeEmail(email);
  return readCustomerAccounts().filter(function (a) { return a.email === e; })[0] || null;
}

// One email namespace across customers AND staff (local mode), so a login
// email can only ever resolve to a single role.
export function customerEmailTaken(email) {
  var e = normalizeEmail(email);
  return !!findCustomerAccount(e) || !!findStaffByEmail(e);
}

// Reads the active customer session. Local-mode sessions are re-validated
// against the account store, so a deleted account can't stay "logged in".
export function getCustomerSession() {
  var s = readJSON('local', CUSTOMER_SESSION_KEY, null);
  if (!s || !s.email) return null;

  if (s.mode === 'api') {
    return {
      email: s.email, firstName: s.firstName || '', lastName: s.lastName || '',
      token: s.token || null, mode: 'api'
    };
  }

  var account = findCustomerAccount(s.email);
  if (!account) return null;
  return {
    email: account.email, firstName: account.firstName, lastName: account.lastName,
    token: null, mode: 'local'
  };
}

// Throws ApiError('Storage unavailable', 0) when the session cannot be saved.
function startCustomerSession(session) {
  requireWrite(writeJSON('local', CUSTOMER_SESSION_KEY, session));
}

// Signing in as a customer replaces any staff session, so a browser never
// holds two roles at once. The new session is written first: if that fails the
// old state is untouched.
function beginCustomerSession(session) {
  startCustomerSession(session);
  removeKey('local', STAFF_SESSION_KEY);
}

// Creates a local account (it does NOT sign in: the user is sent to the Login page
// afterwards). Called only after OTP verification.
export async function registerCustomerLocal(fields) {
  var email = normalizeEmail(fields.email);
  if (customerEmailTaken(email)) {
    throw new ApiError('Email already registered', 409);
  }
  var salt = makeId('salt');
  var account = {
    id: makeId('cust'),
    email: email,
    firstName: normalizeName(fields.firstName),
    lastName: normalizeName(fields.lastName),
    salt: salt,
    passwordHash: await hashPassword(fields.password, salt),
    createdAt: new Date().toISOString()
  };
  var previous = readCustomerAccounts();
  requireWrite(writeJSON('local', CUSTOMER_ACCOUNTS_KEY, previous.concat([account])));
  return account;
}

// Signs in after a successful server-side OTP verification / login.
export function startApiCustomerSession(data, fallbackUser) {
  var user = (data && data.user) || fallbackUser || {};
  beginCustomerSession({
    mode: 'api',
    token: (data && data.token) || null,
    email: normalizeEmail(user.email),
    firstName: normalizeName(user.firstName),
    lastName: normalizeName(user.lastName)
  });
}

// ---------------------------- unified login --------------------------------
// ONE entry point for customers, staff and admins (the Login page). The role is
// decided by whichever account the credentials authenticate - never by the
// user - and the caller redirects by the returned role.
//   API mode:   POST API.LOGIN; the SERVER returns {token, role, user}.
//   Local demo: staff accounts are checked first, then customer accounts. The
//               single email namespace (see customerEmailTaken) means an email
//               only ever belongs to one role.
// Resolves to { role: 'customer' | 'staff' | 'admin' } or throws (ApiError 401
// for bad credentials, 0 when storage is unavailable).
export async function login(email, password) {
  var e = normalizeEmail(email);

  if (API.LOGIN) {
    var data = await apiRequest(API.LOGIN, { method: 'POST', body: { email: e, password: password } });
    var role = data && data.role;
    var user = (data && data.user) || {};
    if (role === 'staff' || role === 'admin') {
      startStaffSession({
        mode: 'api', token: data.token || null, role: role,
        id: user.id || null, email: normalizeEmail(user.email || e), name: user.name || ''
      });
      return { role: role };
    }
    if (role === 'customer') {
      startApiCustomerSession(data, { email: e });
      return { role: 'customer' };
    }
    throw new ApiError('Invalid login response', 502);
  }

  var staff = findStaffByEmail(e);
  if (staff) {
    var staffHash = await hashPassword(password, staff.salt);
    if (staffHash === staff.passwordHash) {
      startStaffSession({ mode: 'local', id: staff.id, email: staff.email });
      return { role: staff.role === 'admin' ? 'admin' : 'staff' };
    }
  }

  var account = findCustomerAccount(e);
  if (account) {
    var hash = await hashPassword(password, account.salt);
    if (hash === account.passwordHash) {
      beginCustomerSession({ email: account.email, mode: 'local' });
      return { role: 'customer' };
    }
  }

  throw new ApiError('Invalid credentials', 401);
}

export function logoutCustomer() {
  var s = getCustomerSession();
  if (s) clearDraft(s.email);
  removeKey('local', CUSTOMER_SESSION_KEY);
}

// Saves the profile name for the ACTIVE account only. Resolves to true/false.
//   API mode:   PATCH API.PROFILE so the name is stored in the database, then
//               the session copy is refreshed from the server's answer.
//   Local demo: edits the account stored on this browser.
export async function updateCustomerProfile(firstName, lastName) {
  var s = getCustomerSession();
  if (!s) return false;
  var f = normalizeName(firstName);
  var l = normalizeName(lastName);

  if (s.mode === 'api') {
    try {
      if (API.PROFILE) {
        var data = await apiRequest(API.PROFILE, {
          method: 'PATCH', token: s.token, body: { firstName: f, lastName: l }
        });
        var u = (data && data.user) || {};
        f = normalizeName(u.firstName || f);
        l = normalizeName(u.lastName || l);
      }
      startCustomerSession({ mode: 'api', token: s.token, email: s.email, firstName: f, lastName: l });
      return true;
    } catch (err) {
      return false;
    }
  }

  var accounts = readCustomerAccounts().map(function (a) {
    return a.email === s.email ? Object.assign({}, a, { firstName: f, lastName: l }) : a;
  });
  return writeJSON('local', CUSTOMER_ACCOUNTS_KEY, accounts);
}

// Change password for the ACTIVE customer.
//   API mode:   POST API.CHANGE_PASSWORD (BACKEND REQUIRED). Until that is set
//               an API-mode session gets ApiError 501 - nothing is faked.
//   Local demo: verifies the current password against the stored salted hash,
//               then stores a NEW salt + hash. The plain password is never
//               stored. This is browser-local demo state, NOT real security.
export async function changeCustomerPassword(currentPassword, newPassword) {
  var s = getCustomerSession();
  if (!s) throw new ApiError('Not signed in', 401);

  if (s.mode === 'api') {
    if (!API.CHANGE_PASSWORD) throw new ApiError('Backend required', 501);
    await apiRequest(API.CHANGE_PASSWORD, {
      method: 'POST', token: s.token,
      body: { currentPassword: currentPassword, newPassword: newPassword }
    });
    return true;
  }

  var account = findCustomerAccount(s.email);
  if (!account) throw new ApiError('Not signed in', 401);
  var currentHash = await hashPassword(currentPassword, account.salt);
  if (currentHash !== account.passwordHash) throw new ApiError('Invalid credentials', 401);

  var salt = makeId('salt');
  var passwordHash = await hashPassword(newPassword, salt);
  var accounts = readCustomerAccounts().map(function (a) {
    return a.email === account.email ? Object.assign({}, a, { salt: salt, passwordHash: passwordHash }) : a;
  });
  requireWrite(writeJSON('local', CUSTOMER_ACCOUNTS_KEY, accounts));
  return true;
}

// Change email for the ACTIVE customer, in two steps. API mode only: the server
// emails a one-time code to the NEW address and only switches the account after
// the code is confirmed. Local demo mode has no inbox, so nothing is faked.
// Step 0: check the current password before the user is allowed to type a new email.
export async function verifyEmailChangePassword(password) {
  var s = getCustomerSession();
  if (!s) throw new ApiError('Not signed in', 401);
  if (s.mode !== 'api' || !API.CHANGE_EMAIL_VERIFY) throw new ApiError('Backend required', 501);
  await apiRequest(API.CHANGE_EMAIL_VERIFY, { method: 'POST', token: s.token, body: { password: password } });
  return true;
}

export async function requestEmailChange(newEmail, password) {
  var s = getCustomerSession();
  if (!s) throw new ApiError('Not signed in', 401);
  if (s.mode !== 'api' || !API.CHANGE_EMAIL_REQUEST) throw new ApiError('Backend required', 501);
  await apiRequest(API.CHANGE_EMAIL_REQUEST, {
    method: 'POST', token: s.token,
    body: { newEmail: normalizeEmail(newEmail), password: password }
  });
  return true;
}

export async function confirmEmailChange(newEmail, code) {
  var s = getCustomerSession();
  if (!s) throw new ApiError('Not signed in', 401);
  if (s.mode !== 'api' || !API.CHANGE_EMAIL_CONFIRM) throw new ApiError('Backend required', 501);
  var data = await apiRequest(API.CHANGE_EMAIL_CONFIRM, {
    method: 'POST', token: s.token,
    body: { newEmail: normalizeEmail(newEmail), code: String(code || '').trim() }
  });
  // The server returns a fresh session for the new email.
  startApiCustomerSession(data, { email: newEmail });
  return true;
}

// True when a CUSTOMER account exists on this browser. Used only by the demo
// forgot-password flow; staff accounts are deliberately excluded so this flow
// can never touch a staff/admin password.
export function customerAccountExistsLocal(email) {
  return !!findCustomerAccount(email);
}

// DEMO ONLY: sets a new password for a local customer account. A real reset
// must be done by the server after it has verified an emailed token/code
// (API.PASSWORD_RESET_CONFIRM - BACKEND REQUIRED).
export async function resetCustomerPasswordLocal(email, newPassword) {
  var account = findCustomerAccount(email);
  if (!account) throw new ApiError('Not found', 404);
  var salt = makeId('salt');
  var passwordHash = await hashPassword(newPassword, salt);
  var accounts = readCustomerAccounts().map(function (a) {
    return a.email === account.email ? Object.assign({}, a, { salt: salt, passwordHash: passwordHash }) : a;
  });
  requireWrite(writeJSON('local', CUSTOMER_ACCOUNTS_KEY, accounts));
  return true;
}

function customerSnapshot() {
  return (readRaw('local', CUSTOMER_SESSION_KEY) || '') + '|' + (readRaw('local', CUSTOMER_ACCOUNTS_KEY) || '');
}

// React hook: re-renders on login/logout/profile edits, in this tab and others.
export function useCustomerSession() {
  var snap = useSyncExternalStore(subscribeStorage, customerSnapshot, function () { return ''; });
  return useMemo(function () { return getCustomerSession(); }, [snap]);
}

// --------------------------------- staff -----------------------------------
function readStaffAccountsRaw() {
  var list = readJSON('local', STAFF_ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function writeStaffAccountsRaw(list) {
  return writeJSON('local', STAFF_ACCOUNTS_KEY, list);
}

export function readStaffAccounts() {
  return readStaffAccountsRaw();
}

export function findStaffByEmail(email) {
  var e = normalizeEmail(email);
  return readStaffAccountsRaw().filter(function (a) { return a.email === e; })[0] || null;
}

export function hasLocalStaffAccounts() {
  return readStaffAccountsRaw().length > 0;
}

export function hashStaffPassword(password, salt) {
  return hashPassword(password, salt);
}

// The role in a local-mode session is always re-read from the account store,
// so demoting/removing a staff member takes effect immediately. In API mode
// the role comes from the server-issued session (and must be re-checked by
// the server on every request).
export function getStaffSession() {
  var s = readJSON('local', STAFF_SESSION_KEY, null);
  if (!s || !s.email) return null;

  if (s.mode === 'api') {
    if (!s.role) return null;
    return { id: s.id || null, email: s.email, name: s.name || '', role: s.role, token: s.token || null, mode: 'api' };
  }

  var account = readStaffAccountsRaw().filter(function (a) { return a.id === s.id; })[0];
  if (!account) return null;
  return { id: account.id, email: account.email, name: account.name, role: account.role, token: null, mode: 'local' };
}

// Throws ApiError('Storage unavailable', 0) when the session cannot be saved.
// Signing in as staff/admin replaces any customer session (one role at a time).
export function startStaffSession(session) {
  requireWrite(writeJSON('local', STAFF_SESSION_KEY, session));
  removeKey('local', CUSTOMER_SESSION_KEY);
}

// Demo-only first-run setup: when no staff accounts exist, the first admin can
// be created on the /staff-login setup screen. Disabled in API mode. A real
// deployment must provision staff server-side instead (BACKEND REQUIRED).
export async function createFirstAdminLocal(fields) {
  if (API.LOGIN || hasLocalStaffAccounts()) throw new ApiError('Setup unavailable', 403);
  if (findCustomerAccount(fields.email)) throw new ApiError('Email already registered', 409);
  var salt = makeId('salt');
  var account = {
    id: makeId('staff'),
    name: normalizeName(fields.name),
    email: normalizeEmail(fields.email),
    role: 'admin',
    salt: salt,
    passwordHash: await hashPassword(fields.password, salt)
  };
  requireWrite(writeStaffAccountsRaw([account]));
  try {
    startStaffSession({ mode: 'local', id: account.id, email: account.email });
  } catch (err) {
    // Roll back so the setup screen is offered again on retry.
    removeKey('local', STAFF_ACCOUNTS_KEY);
    throw err;
  }
  return account;
}

export function logoutStaff() {
  removeKey('local', STAFF_SESSION_KEY);
}

function staffSnapshot() {
  return (readRaw('local', STAFF_SESSION_KEY) || '') + '|' + (readRaw('local', STAFF_ACCOUNTS_KEY) || '');
}

export function useStaffSession() {
  var snap = useSyncExternalStore(subscribeStorage, staffSnapshot, function () { return ''; });
  return useMemo(function () { return getStaffSession(); }, [snap]);
}
