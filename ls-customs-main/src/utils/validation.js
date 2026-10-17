export var NAME_MAX = 25;
export var EMAIL_MAX = 254;
export var PASSWORD_MESSAGE = 'Password must be 8-32 characters with at least one letter and one number.';

// Unicode letters (so Muñoz, Peña, José are fine), spaces, apostrophes, hyphens
// and periods; must start with a letter.
var nameRule = /^\p{L}[\p{L}\s'.-]*$/u;
export var NAME_MESSAGE = 'Enter a valid name (letters, spaces, apostrophes, hyphens, periods).';

export function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// Trimmed, non-empty, within NAME_MAX, allowed characters only, starts with a letter.
export function isValidName(value) {
  var n = normalizeName(value);
  return n.length > 0 && n.length <= NAME_MAX && nameRule.test(n);
}

var emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shape check only (a real server must verify the address is deliverable).
export function isValidEmail(value) {
  var e = String(value || '').trim();
  return e.length > 0 && e.length <= EMAIL_MAX && emailRule.test(e);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Any characters are allowed as long as the length and letter+number rules
// hold, so the rule and PASSWORD_MESSAGE describe exactly the same thing.
export function isValidPassword(value) {
  var p = String(value || '');
  return p.length >= 8 && p.length <= 32 && /[A-Za-z]/.test(p) && /\d/.test(p);
}
