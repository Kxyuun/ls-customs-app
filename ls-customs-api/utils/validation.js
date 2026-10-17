// Input validation and normalization shared by the auth and staff routes.
// The frontend uses the same rules (src/utils/validation.js) so both sides agree.
const NAME_MAX = 25;
const nameRule = /^\p{L}[\p{L}\s'.-]*$/u;
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizeName = (v) => String(v || '').replace(/\s+/g, ' ').trim();
const isValidEmail = (v) => {
  const e = String(v || '').trim();
  return e.length > 0 && e.length <= 254 && emailRule.test(e);
};
const isValidName = (v) => {
  const n = normalizeName(v);
  return n.length > 0 && n.length <= NAME_MAX && nameRule.test(n);
};
// Same rule as the frontend: 8-32 chars, at least one letter and one number
const isValidPassword = (v) => {
  const p = String(v || '');
  return p.length >= 8 && p.length <= 32 && /[A-Za-z]/.test(p) && /\d/.test(p);
};
const displayName = (u) =>
  u.name || [u.firstName, u.lastName].filter(Boolean).join(' ');

module.exports = { normalizeEmail, normalizeName, isValidEmail, isValidName, isValidPassword, displayName };
