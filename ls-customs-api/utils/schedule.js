// Shop hours, mirroring src/data/businessHours.js in the frontend.
// Day keys are JS getDay() values: 0 = Sunday ... 6 = Saturday. null = closed.
const BUSINESS_HOURS = {
  0: null,
  1: { open: 8, close: 21 },
  2: { open: 8, close: 21 },
  3: { open: 8, close: 21 },
  4: { open: 8, close: 21 },
  5: { open: 8, close: 21 },
  6: { open: 8, close: 17 },
};
const SLOT_INTERVAL_HOURS = 2;
const BOOKING_WINDOW_DAYS = 30;
const SHOP_TIMEZONE = 'Asia/Manila';

function isValidDateString(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function dayOfWeek(s) {
  return new Date(s + 'T00:00:00Z').getUTCDay();
}

// Today's date in the shop's timezone, as YYYY-MM-DD
function todayString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIMEZONE }).format(new Date());
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Start hours offered on a date, or null if the shop is closed
function slotHoursFor(dateStr) {
  const h = BUSINESS_HOURS[dayOfWeek(dateStr)];
  if (!h) return null;
  const hours = [];
  for (let x = h.open; x < h.close; x += SLOT_INTERVAL_HOURS) hours.push(x);
  return hours;
}

// "10:00 AM" -> 10, "1:00 PM" -> 13. Returns null if it is not that format.
function parseSlot(label) {
  const m = /^(\d{1,2}):00\s*(AM|PM)$/i.exec(String(label || '').trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (h < 1 || h > 12) return null;
  const pm = m[2].toUpperCase() === 'PM';
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  return h;
}

module.exports = {
  BOOKING_WINDOW_DAYS, isValidDateString, dayOfWeek, todayString, addDays, slotHoursFor, parseSlot,
};
