import { API } from '../config/api.js';
import { apiRequest, ApiError } from './api.js';
import { readJSON, writeJSON, makeId } from './storage.js';

export { subscribeStorage as subscribeNotifications } from './storage.js';

// ---------------------------------------------------------------------------
// IN-APP customer notifications. There is NO notification service yet:
//   * Local demo mode: when staff move a booking to Ready for Pickup or
//     Completed, a record is added here (this browser only) and the customer
//     sees it in My Account. NOTHING is emailed, texted or pushed.
//   * API mode: the SERVER must create these when a booking status changes and
//     deliver any email / SMS / push. Real-time + persistent delivery is
//     BACKEND REQUIRED. This file only reads them from API.NOTIFICATIONS.
//
// Notification shape:
//   { id, customerEmail, bookingId, referenceCode, type, message, read, createdAt }
// ---------------------------------------------------------------------------
var KEY = 'lsc_notifications';

// Statuses (see bookingStatus.js) that notify the customer.
var NOTIFY_ON = {
  progress: 'We started working on your vehicle.',
  ready: 'Your vehicle is ready for pickup.',
  done: 'Your booking is completed. Thank you for choosing LS Customs.',
  cancelled: 'Your booking was cancelled.'
};

function readAll() {
  var list = readJSON('local', KEY, []);
  return Array.isArray(list) ? list : [];
}

// Called by the local booking store after a status change was saved. Returns
// true if a record was stored. De-duplicated per booking + status.
export function recordStatusNotification(booking) {
  if (!booking || !booking.customerEmail || !NOTIFY_ON[booking.status]) return false;
  var all = readAll();
  var exists = all.some(function (n) { return n.bookingId === booking.id && n.type === booking.status; });
  if (exists) return false;
  all.push({
    id: makeId('ntf'),
    customerEmail: String(booking.customerEmail).toLowerCase(),
    bookingId: booking.id,
    referenceCode: booking.referenceCode,
    type: booking.status,
    message: NOTIFY_ON[booking.status],
    read: false,
    createdAt: new Date().toISOString()
  });
  return writeJSON('local', KEY, all);
}

// Customer-scoped. Fails closed: a missing/empty customerEmail returns nothing.
export async function listNotifications(options) {
  var opts = options || {};
  if (API.NOTIFICATIONS) {
    var data = await apiRequest(API.NOTIFICATIONS, { token: opts.token });
    return Array.isArray(data) ? data : (data && data.notifications) || [];
  }
  if (!opts.customerEmail) return [];
  var e = String(opts.customerEmail).toLowerCase();
  return readAll()
    .filter(function (n) { return n.customerEmail === e; })
    .sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
}

export async function markNotificationRead(id, options) {
  var opts = options || {};
  if (API.NOTIFICATIONS) {
    await apiRequest(API.NOTIFICATIONS + '/' + encodeURIComponent(id), {
      method: 'PATCH', body: { read: true }, token: opts.token
    });
    return true;
  }
  if (!opts.customerEmail) throw new ApiError('Forbidden', 403);
  var e = String(opts.customerEmail).toLowerCase();
  var changed = false;
  var next = readAll().map(function (n) {
    if (n.id === id && n.customerEmail === e && !n.read) { changed = true; return Object.assign({}, n, { read: true }); }
    return n;
  });
  if (!changed) return true;
  if (!writeJSON('local', KEY, next)) throw new ApiError('Storage unavailable', 0);
  return true;
}
