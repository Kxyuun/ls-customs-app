const crypto = require('crypto');
const OtpCode = require('../models/OtpCode');
const { sendMail } = require('./mailer');
const { codeEmail } = require('./emailTemplates');

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// `email` is where the code is SENT (for an email change that is the NEW address).
// `userId` (optional) ties the code to one logged-in account.
async function issueCode(email, purpose, userId) {
  const filter = { email, purpose, used: false };
  if (userId) filter.userId = userId;
  // Invalidate any earlier unused code for the same email + purpose
  await OtpCode.updateMany(filter, { used: true });
  const code = String(crypto.randomInt(100000, 1000000));
  await OtpCode.create({ email, purpose, userId: userId || undefined, code, expiresAt: new Date(Date.now() + TTL_MS) });
  const mail = codeEmail(purpose, code, TTL_MS / 60000);
  await sendMail({ to: email, ...mail });
}

// Returns true (and burns the code) if the code is correct, unused and not expired.
async function consumeCode(email, purpose, code, userId) {
  const filter = { email, purpose, used: false, expiresAt: { $gt: new Date() } };
  if (userId) filter.userId = userId;
  const rec = await OtpCode.findOne(filter).sort({ _id: -1 });
  if (!rec || rec.attempts >= MAX_ATTEMPTS) return false;
  const given = String(code || '').trim();
  const a = Buffer.from(rec.code);
  const b = Buffer.from(given);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    rec.attempts += 1;
    await rec.save();
    return false;
  }
  rec.used = true;
  await rec.save();
  return true;
}

module.exports = { issueCode, consumeCode };
