import { API } from '../config/api.js';
import { apiRequest } from './api.js';
import { addDays, dayOfWeek } from './dates.js';
import { hoursForDay, formatHour, SLOT_INTERVAL_HOURS } from '../data/businessHours.js';

// ---------------------------------------------------------------------------
// AVAILABILITY IS LOCAL DEMO DATA. Opening hours come from businessHours.js
// and the "fully booked" days below are SAMPLE values, not real shop capacity.
// getDayAvailability() is async on purpose: point API.AVAILABILITY at a real
// endpoint (GET ?date=YYYY-MM-DD -> { status: 'open'|'full'|'closed',
// slots: [{ hour, available }] }) and callers need no changes.
// ---------------------------------------------------------------------------
export var DEMO_FULL_DAY_OFFSETS = [3, 4, 5];

export function getDemoFullDates(todayStr) {
  return DEMO_FULL_DAY_OFFSETS.map(function (n) { return addDays(todayStr, n); });
}

function buildSlots(hours) {
  var slots = [];
  for (var h = hours.open; h < hours.close; h += SLOT_INTERVAL_HOURS) {
    slots.push({ hour: h, label: formatHour(h), available: true });
  }
  return slots;
}

export async function getDayAvailability(dateStr, todayStr) {
  if (API.AVAILABILITY) {
    var data = await apiRequest(API.AVAILABILITY + '?date=' + encodeURIComponent(dateStr));
    var slots = (data.slots || []).map(function (s) {
      return { hour: s.hour, label: formatHour(s.hour), available: s.available !== false };
    });
    return { status: data.status || 'open', slots: slots, source: 'api' };
  }

  var hours = hoursForDay(dayOfWeek(dateStr));
  if (!hours) return { status: 'closed', slots: [], source: 'demo' };
  if (getDemoFullDates(todayStr).indexOf(dateStr) !== -1) return { status: 'full', slots: [], source: 'demo' };
  return { status: 'open', slots: buildSlots(hours), source: 'demo' };
}
