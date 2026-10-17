const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { sendMail } = require('../utils/mailer');
const { emailChangedNoticeEmail } = require('../utils/emailTemplates');
const asyncHandler = require('../utils/asyncHandler');
const { auth, requireRole } = require('../middleware/auth');
const { issueCode, consumeCode } = require('../utils/otp');
const {
  normalizeEmail, normalizeName, isValidEmail, isValidName, isValidPassword, displayName,
} = require('../utils/validation');

const signToken = (u) =>
  jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const userShape = (u) => ({
  id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, name: displayName(u),
});

// ---- rate limits ----
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});
// "max 3 requests per email per 10 minutes". A factory, so signup codes, password
// resets and email changes each get their own counter instead of sharing one.
const emailLimiter = (max = 3) => rateLimit({
  windowMs: 10 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.userId) || normalizeEmail(req.body && req.body.email) || req.ip,
  message: { error: 'Too many requests. Try again in a few minutes.' },
});
const otpSendLimiter = emailLimiter();
const resetLimiter = emailLimiter();
const emailChangeLimiter = emailLimiter();
const passwordCheckLimiter = emailLimiter(10); // wrong-password guesses are capped too

// A real hash to compare against when the email doesn't exist, so a missing
// account and a wrong password take about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-1', 10);

// ---------- LOGIN ----------
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const user = email ? await User.findOne({ email }) : null;
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(user), role: user.role, user: userShape(user) });
}));

// ---------- OTP_SEND ----------
router.post('/otp/send', otpSendLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  // If the email already has an account, say so (409) so the signup page can offer
  // "log in instead". Every other address gets a code by email (any inbox works).
  if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });
  await issueCode(email, 'signup');
  res.status(204).end();
}));

// ---------- OTP_VERIFY (verifies code AND creates the account) ----------
router.post('/otp/verify', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const firstName = normalizeName(req.body.firstName);
  const lastName = normalizeName(req.body.lastName);
  const { code, password } = req.body;

  if (!isValidEmail(email) || !isValidName(firstName) || !isValidName(lastName) || !isValidPassword(password)) {
    return res.status(400).json({ error: 'Invalid details' });
  }
  if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });

  if (!(await consumeCode(email, 'signup', code))) {
    return res.status(400).json({ error: 'Code is wrong or expired' });
  }

  let user;
  try {
    user = await User.create({
      email, firstName, lastName, role: 'customer', passwordHash: await bcrypt.hash(password, 10),
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
  // No token: the account is created but the user must log in first.
  res.status(201).json({ role: 'customer', user: userShape(user) });
}));

// ---------- CHANGE_PASSWORD ----------
router.post('/password/change', auth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: 'New password is too weak' });
  const user = await User.findById(req.user.userId);
  const ok = await bcrypt.compare(String(currentPassword || ''), user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.status(204).end();
}));

// ---------- PASSWORD_RESET_REQUEST (always 204) ----------
router.post('/password/reset-request', resetLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (isValidEmail(email) && (await User.exists({ email }))) {
    try {
      await issueCode(email, 'reset');
    } catch (e) {
      console.error('Reset email failed:', e.message); // never leak this to the caller
    }
  }
  res.status(204).end();
}));

// ---------- PASSWORD_RESET_CONFIRM ----------
router.post('/password/reset-confirm', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { code, newPassword } = req.body;
  if (!isValidEmail(email) || !isValidPassword(newPassword)) {
    return res.status(400).json({ error: 'Invalid details' });
  }
  const user = await User.findOne({ email });
  // Same error whether the account is missing or the code is wrong
  if (!user || !(await consumeCode(email, 'reset', code))) {
    return res.status(400).json({ error: 'Code is wrong or expired' });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordChangedAt = new Date(); // ends all older sessions
  await user.save();
  res.status(204).end();
}));

// ---------- PROFILE: update the logged-in customer's name ----------
// PATCH /api/profile  (Bearer)  {firstName, lastName} -> {user}
router.patch('/profile', auth, requireRole('customer'), asyncHandler(async (req, res) => {
  const firstName = normalizeName(req.body.firstName);
  const lastName = normalizeName(req.body.lastName);
  if (!isValidName(firstName) || !isValidName(lastName)) return res.status(400).json({ error: 'Invalid name' });
  const user = await User.findById(req.user.userId);
  user.firstName = firstName;
  user.lastName = lastName;
  await user.save();
  res.json({ user: userShape(user) });
}));

// ---------- CHANGE EMAIL, step 0: check the current password ----------
// POST /api/email/verify-password  (Bearer)  {password} -> 204, or 401 if wrong
router.post('/email/verify-password', auth, requireRole('customer'), passwordCheckLimiter, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Password is incorrect' });
  }
  res.status(204).end();
}));

// ---------- CHANGE EMAIL, step 1: send a code to the NEW address ----------
// POST /api/email/change-request  (Bearer)  {newEmail, password}
router.post('/email/change-request', auth, requireRole('customer'), emailChangeLimiter, asyncHandler(async (req, res) => {
  const newEmail = normalizeEmail(req.body.newEmail);
  if (!isValidEmail(newEmail)) return res.status(400).json({ error: 'Invalid email' });
  if (newEmail === req.user.email) return res.status(400).json({ error: 'That is already your email' });

  const user = await User.findById(req.user.userId);
  if (!(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Password is incorrect' });
  }
  if (await User.exists({ email: newEmail })) return res.status(409).json({ error: 'That email is already in use' });

  await issueCode(newEmail, 'email-change', user._id); // goes to the NEW inbox
  res.status(204).end();
}));

// ---------- CHANGE EMAIL, step 2: confirm the code, switch the email ----------
// POST /api/email/change-confirm  (Bearer)  {newEmail, code} -> {token, role, user}
router.post('/email/change-confirm', auth, requireRole('customer'), asyncHandler(async (req, res) => {
  const newEmail = normalizeEmail(req.body.newEmail);
  if (!isValidEmail(newEmail)) return res.status(400).json({ error: 'Invalid email' });

  const user = await User.findById(req.user.userId);
  const oldEmail = user.email;
  if (await User.exists({ email: newEmail })) return res.status(409).json({ error: 'That email is already in use' });
  if (!(await consumeCode(newEmail, 'email-change', req.body.code, user._id))) {
    return res.status(400).json({ error: 'Code is wrong or expired' });
  }

  user.email = newEmail;
  try {
    await user.save();
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That email is already in use' });
    throw e;
  }
  // Bookings and notifications are linked by email, so move them with the account.
  await Booking.updateMany({ customerEmail: oldEmail }, { customerEmail: newEmail });
  await Notification.updateMany({ customerEmail: oldEmail }, { customerEmail: newEmail });

  // Tell the OLD address, so a hijacked session can't silently take over the account.
  sendMail({ to: oldEmail, ...emailChangedNoticeEmail(oldEmail, newEmail) })
    .catch((e) => console.error('Email-changed notice failed:', e.message));

  res.json({ token: signToken(user), role: user.role, user: userShape(user) });
}));

module.exports = router;
