// User model: one collection for customers, staff and admins (the role field decides).
// Customers use firstName/lastName; staff and admins use name. The password is stored
// only as a bcrypt hash and is removed from every JSON response (see toJSON.js).
const { Schema, model } = require('mongoose');
const toJSON = require('./toJSON');

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'staff', 'admin'], required: true }, // always read from the database
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    name: { type: String, trim: true }, // used by staff/admin
    passwordChangedAt: Date, // set on password reset so old tokens stop working
  },
  { timestamps: true }
);
toJSON(userSchema);
module.exports = model('User', userSchema);
