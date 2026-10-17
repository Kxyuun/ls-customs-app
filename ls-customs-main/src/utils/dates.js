import { businessInfo } from '../data/businessInfo.js';

// All booking dates are plain 'YYYY-MM-DD' strings in the SHOP's time zone
// (Asia/Manila). Never use toISOString() for these: it converts to UTC and
// can shift the date by a day for anyone east of Greenwich.
function pad(n) { return n < 10 ? '0' + n : String(n); }

export function getShopNow(date) {
  var d = date || new Date();
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessInfo.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d);
  var map = {};
  parts.forEach(function (p) { map[p.type] = p.value; });
  return {
    dateStr: map.year + '-' + map.month + '-' + map.day,
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

function parse(dateStr) {
  var p = dateStr.split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2] };
}

export function addDays(dateStr, n) {
  var p = parse(dateStr);
  var d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

export function dayOfWeek(dateStr) {
  var p = parse(dateStr);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function isValidDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}
