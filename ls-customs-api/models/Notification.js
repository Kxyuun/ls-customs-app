// Notification model: an in-app message created by the server whenever a booking's
// status changes. Linked to the customer by email and to the booking by bookingId.
const { Schema, model } = require('mongoose');
const toJSON = require('./toJSON');

const notificationSchema = new Schema(
  {
    customerEmail: { type: String, required: true, lowercase: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    referenceCode: String,
    type: { type: String, enum: ['progress', 'ready', 'done', 'cancelled'] },
    title: String,
    message: String,
    read: { type: Boolean, default: false }, // set true when the customer marks it as read
  },
  { timestamps: true }
);
notificationSchema.index({ customerEmail: 1 });
toJSON(notificationSchema);
module.exports = model('Notification', notificationSchema);
