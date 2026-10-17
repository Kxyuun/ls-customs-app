// One-time code model for signup, password reset and email change.
// Codes expire after 10 minutes (TTL index below), can be used once, and allow 5 attempts.
const { Schema, model } = require('mongoose');
const toJSON = require('./toJSON');

const otpCodeSchema = new Schema({
  email: { type: String, required: true, lowercase: true },
  purpose: { type: String, enum: ['signup', 'reset', 'email-change'], required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // set for email-change codes
  code: String,
  expiresAt: Date,
  used: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
});
// MongoDB deletes expired codes automatically
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpCodeSchema.index({ email: 1, purpose: 1 });
toJSON(otpCodeSchema);
module.exports = model('OtpCode', otpCodeSchema);
