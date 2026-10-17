import { API } from '../config/api.js';
import { apiRequest, ApiError } from './api.js';
import { makeId } from './storage.js';
import { normalizeEmail, normalizeName } from './validation.js';
import { readStaffAccounts, writeStaffAccountsRaw, hashStaffPassword, findCustomerAccount } from './auth.js';

// Staff-account management for the admin panel. Local mode edits the demo
// staff store; API mode calls API.STAFF_ACCOUNTS (GET list, POST create,
// DELETE /:id). The safety rules below are enforced here for local mode, and
// a real backend must enforce them too.
function publicShape(a) {
  return { id: a.id, name: a.name, email: a.email, role: a.role };
}

export async function listStaff(options) {
  if (API.STAFF_ACCOUNTS) {
    var data = await apiRequest(API.STAFF_ACCOUNTS, { token: options && options.token });
    return Array.isArray(data) ? data : (data && data.staff) || [];
  }
  return readStaffAccounts().map(publicShape);
}

export async function addStaff(fields, options) {
  var name = normalizeName(fields.name);
  var email = normalizeEmail(fields.email);
  var role = fields.role === 'admin' ? 'admin' : 'staff';

  if (API.STAFF_ACCOUNTS) {
    var created = await apiRequest(API.STAFF_ACCOUNTS, {
      method: 'POST', body: { name: name, email: email, role: role, password: fields.password },
      token: options && options.token
    });
    return created;
  }

  var list = readStaffAccounts();
  // One email = one role: also refuse an email that is already a customer login.
  if (list.some(function (a) { return a.email === email; }) || findCustomerAccount(email)) {
    throw new ApiError('Duplicate email', 409);
  }
  var salt = makeId('salt');
  var account = {
    id: makeId('staff'), name: name, email: email, role: role, salt: salt,
    passwordHash: await hashStaffPassword(fields.password, salt)
  };
  list.push(account);
  writeStaffAccountsRaw(list);
  return publicShape(account);
}

export async function removeStaff(id, options) {
  var opts = options || {};

  if (API.STAFF_ACCOUNTS) {
    await apiRequest(API.STAFF_ACCOUNTS + '/' + encodeURIComponent(id), { method: 'DELETE', token: opts.token });
    return true;
  }

  var list = readStaffAccounts();
  var target = list.filter(function (a) { return a.id === id; })[0];
  if (!target) throw new ApiError('Not found', 404);
  if (opts.currentId && target.id === opts.currentId) throw new ApiError('Cannot remove yourself', 409);
  var admins = list.filter(function (a) { return a.role === 'admin'; });
  if (target.role === 'admin' && admins.length <= 1) throw new ApiError('Last admin', 409);
  writeStaffAccountsRaw(list.filter(function (a) { return a.id !== id; }));
  return true;
}
