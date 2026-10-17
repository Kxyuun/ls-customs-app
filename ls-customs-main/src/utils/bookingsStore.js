import { API } from '../config/api.js';
import { apiRequest, ApiError } from './api.js';
import { readJSON, writeJSON, makeId } from './storage.js';
import { canTransition } from './bookingStatus.js';
import { recordStatusNotification } from './notificationsStore.js';

export { subscribeStorage as subscribeBookings } from './storage.js';

// ---------------------------------------------------------------------------
// ONE booking data model + store used by Book (create), My Bookings (list /
// cancel) and the staff Dashboard (list / status changes).
//
// Booking shape:
//   { id, referenceCode, customerEmail, customerName, vehicle, baseService,
//     additionalServices[], services[], date, timeSlot, payment,
//     totalEstimate, status, createdAt, updatedAt }
//
// Local mode persists to localStorage on this browser only. Set API.BOOKINGS
// to move to a real backend (GET list, POST create, PATCH /:id {status}); the
// server must own IDs, reference codes and transition rules.
// ---------------------------------------------------------------------------
var KEY = 'lsc_bookings';

function readAll() {
  var list = readJSON('local', KEY, []);
  return Array.isArray(list) ? list : [];
}

function newReference(existing) {
  var code;
  do {
    code = 'LSC-' + Math.floor(100000 + Math.random() * 900000);
  } while (existing.some(function (b) { return b.referenceCode === code; }));
  return code;
}

export async function listBookings(options) {
  var opts = options || {};
  // Fail closed: a customer-scoped call whose email is empty must not fall
  // through to "all bookings". Staff calls simply omit the key.
  var scoped = Object.prototype.hasOwnProperty.call(opts, 'customerEmail');
  if (scoped && !opts.customerEmail) return [];
  if (API.BOOKINGS) {
    var data = await apiRequest(API.BOOKINGS, { token: opts.token });
    return Array.isArray(data) ? data : (data && data.bookings) || [];
  }
  var all = readAll();
  if (scoped) {
    var e = String(opts.customerEmail).toLowerCase();
    all = all.filter(function (b) { return b.customerEmail === e; });
  }
  return all.slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
}

export async function createBooking(payload, customer) {
  if (API.BOOKINGS) {
    var data = await apiRequest(API.BOOKINGS, { method: 'POST', body: payload, token: customer.token });
    return data;
  }
  var all = readAll();
  var now = new Date().toISOString();
  var booking = Object.assign({}, payload, {
    id: makeId('bk'),
    referenceCode: newReference(all),
    customerEmail: customer.email.toLowerCase(),
    customerName: (customer.firstName + ' ' + customer.lastName).trim(),
    status: 'pending',
    createdAt: now,
    updatedAt: now
  });
  all.push(booking);
  if (!writeJSON('local', KEY, all)) throw new ApiError('Storage unavailable', 0);
  return booking;
}

// Applies a status change after checking the transition rules. Reads the
// CURRENT stored status (not a stale UI copy) before deciding.
export async function updateBookingStatus(id, nextStatus, options) {
  var opts = options || {};

  if (API.BOOKINGS) {
    var data = await apiRequest(API.BOOKINGS + '/' + encodeURIComponent(id), {
      method: 'PATCH', body: { status: nextStatus }, token: opts.token
    });
    return data;
  }

  var all = readAll();
  var index = all.findIndex(function (b) { return b.id === id; });
  if (index === -1) throw new ApiError('Booking not found', 404);
  var current = all[index];
  if (opts.customerEmail && current.customerEmail !== opts.customerEmail.toLowerCase()) {
    throw new ApiError('Forbidden', 403);
  }
  if (!canTransition(current.status, nextStatus)) {
    throw new ApiError('Invalid status change', 409);
  }
  var updated = Object.assign({}, current, { status: nextStatus, updatedAt: new Date().toISOString() });
  all[index] = updated;
  if (!writeJSON('local', KEY, all)) throw new ApiError('Storage unavailable', 0);
  // Local demo only: leave an in-app note for the customer. In API mode the
  // server creates notifications (BACKEND REQUIRED). Never blocks the status change.
  try { recordStatusNotification(updated); } catch (e) { /* ignore */ }
  return updated;
}
