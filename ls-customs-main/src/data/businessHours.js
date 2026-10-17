// ONE source of truth for opening hours, the booking window and slot length.
// Home (weekly hours, contact), Book (schedule copy, slots) and the
// availability helper all read from here.
//
// Day keys are JS getDay() values: 0 = Sunday ... 6 = Saturday.
// A day with `null` is closed.
export var businessHours = {
  0: null,
  1: { open: 8, close: 21 },
  2: { open: 8, close: 21 },
  3: { open: 8, close: 21 },
  4: { open: 8, close: 21 },
  5: { open: 8, close: 21 },
  6: { open: 8, close: 17 }
};

// Appointment start times are offered every SLOT_INTERVAL_HOURS from opening
// until (not including) closing. A slot is an appointment START time, not the
// length of the job — see the unresolved design question in the final report.
export var SLOT_INTERVAL_HOURS = 2;
export var BOOKING_WINDOW_DAYS = 30;

var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var displayOrder = [1, 2, 3, 4, 5, 6, 0];

export function formatHour(hour) {
  var period = hour >= 12 ? 'PM' : 'AM';
  var display = hour % 12 === 0 ? 12 : hour % 12;
  return display + ':00 ' + period;
}

function formatShortHour(hour) {
  var period = hour >= 12 ? 'PM' : 'AM';
  var display = hour % 12 === 0 ? 12 : hour % 12;
  return display + ' ' + period;
}

export function hoursForDay(dayIndex) {
  return businessHours[dayIndex] || null;
}

export function weeklyHoursRows() {
  return displayOrder.map(function (d) {
    var h = businessHours[d];
    return {
      day: dayNames[d],
      hours: h ? formatHour(h.open) + ' - ' + formatHour(h.close) : 'Closed',
      open: !!h
    };
  });
}

// "Mon–Fri: 8 AM – 9 PM | Sat: 8 AM – 5 PM" built from businessHours, grouping
// consecutive days that share the same hours.
export function hoursSummary() {
  var groups = [];
  displayOrder.forEach(function (d) {
    var h = businessHours[d];
    if (!h) return;
    var key = h.open + '-' + h.close;
    var last = groups[groups.length - 1];
    if (last && last.key === key && last.days[last.days.length - 1] === (d === 0 ? 7 : d) - 1) {
      last.days.push(d === 0 ? 7 : d);
    } else {
      groups.push({ key: key, days: [d === 0 ? 7 : d], open: h.open, close: h.close });
    }
  });
  return groups.map(function (g) {
    var first = dayShort[g.days[0] % 7];
    var lastDay = dayShort[g.days[g.days.length - 1] % 7];
    var label = g.days.length > 1 ? first + '\u2013' + lastDay : first;
    return label + ': ' + formatShortHour(g.open) + ' \u2013 ' + formatShortHour(g.close);
  }).join(' | ');
}

export function closedDaysText() {
  var closed = displayOrder.filter(function (d) { return !businessHours[d]; }).map(function (d) { return dayNames[d]; });
  return closed.join(', ');
}

export function openDaysPerWeek() {
  return displayOrder.filter(function (d) { return !!businessHours[d]; }).length;
}

export function dayName(dayIndex) {
  return dayNames[dayIndex];
}
