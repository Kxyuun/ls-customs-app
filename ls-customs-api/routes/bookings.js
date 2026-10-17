const router = require('express').Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { auth, requireRole } = require('../middleware/auth');
const { getAvailability } = require('../utils/availability');
const { sendMail } = require('../utils/mailer');
const { priceBooking } = require('../utils/pricing');
const { statusEmail, notificationMessage, STATUS_COPY } = require('../utils/emailTemplates');
const {
  isValidDateString, todayString, addDays, parseSlot, BOOKING_WINDOW_DAYS,
} = require('../utils/schedule');

const TRANSITIONS = {
  pending: ['progress', 'cancelled'],
  progress: ['ready', 'cancelled'],
  ready: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};


// Current time in the shop's timezone, as minutes since midnight
function shopNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parseInt(parts.find((x) => x.type === t).value, 10);
  return get('hour') * 60 + get('minute');
}

const VEHICLES = ['Sedan', 'SUV', 'Motorcycle'];
const PAYMENTS = ['GCash', 'Maya', 'Cash'];

// ---------- LIST ----------
router.get('/', auth, asyncHandler(async (req, res) => {
  const filter = req.user.role === 'customer' ? { customerEmail: req.user.email } : {};
  res.json(await Booking.find(filter).sort({ createdAt: -1 }));
}));

// ---------- CREATE ----------
router.post('/', auth, requireRole('customer'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const { vehicle, date, timeSlot, payment } = b;
  // One or more service types. (A single `baseService` string is still accepted.)
  const types = Array.isArray(b.serviceTypes) && b.serviceTypes.length
    ? b.serviceTypes
    : (typeof b.baseService === 'string' && b.baseService ? [b.baseService] : []);

  if (!VEHICLES.includes(vehicle)) return res.status(400).json({ error: 'Invalid vehicle' });
  if (!PAYMENTS.includes(payment)) return res.status(400).json({ error: 'Invalid payment method' });
  if (!types.length) return res.status(400).json({ error: 'Pick a service' });
  // The server prices the booking itself (car wash depends on vehicle type);
  // any total sent by the browser is ignored.
  const priced = priceBooking(vehicle, types, b.additionalServices);
  if (priced.error) return res.status(400).json({ error: priced.error });
  if (!isValidDateString(date)) return res.status(400).json({ error: 'Invalid date' });

  const today = todayString();
  if (date < today || date > addDays(today, BOOKING_WINDOW_DAYS)) {
    return res.status(400).json({ error: 'Date is outside the booking window' });
  }

  // The slot must exist for that day and still have room (checked on the server)
  const hour = parseSlot(timeSlot);
  const avail = await getAvailability(date);
  const slot = avail.slots.find((s) => s.hour === hour);
  if (!slot) return res.status(400).json({ error: 'That time is not offered' });
  // Same rule as the booking page: a slot that has already started today is closed
  if (date === today && slot.hour * 60 <= shopNowMinutes()) {
    return res.status(400).json({ error: 'That time has already passed' });
  }
  if (!slot.available) return res.status(409).json({ error: 'That time slot is no longer available' });

  for (let i = 0; i < 5; i++) {
    try {
      const booking = await Booking.create({
        referenceCode: 'LSC-' + Math.floor(100000 + Math.random() * 900000),
        customerEmail: req.user.email,
        customerName: req.user.name,
        vehicle,
        baseService: priced.serviceTypes[0],
        serviceTypes: priced.serviceTypes,
        additionalServices: priced.addons,
        services: priced.services,
        date, timeSlot, payment, totalEstimate: priced.total,
        status: 'pending', // always set by the server
      });
      return res.status(201).json(booking);
    } catch (e) {
      if (e.code !== 11000) throw e; // duplicate reference code -> try again
    }
  }
  res.status(500).json({ error: 'Could not generate a reference code' });
}));

// ---------- UPDATE STATUS ----------
router.patch('/:id', auth, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  if (!Object.keys(TRANSITIONS).includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Not found' });

  if (req.user.role === 'customer') {
    // Other people's bookings look like they don't exist
    if (booking.customerEmail !== req.user.email) return res.status(404).json({ error: 'Not found' });
    if (status !== 'cancelled' || booking.status !== 'pending') {
      return res.status(403).json({ error: 'Customers can only cancel their own pending bookings' });
    }
  }

  if (!TRANSITIONS[booking.status].includes(status)) {
    return res.status(409).json({ error: 'Cannot go from ' + booking.status + ' to ' + status });
  }

  // Atomic: only applies if the status is still what we just read
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    { status },
    { new: true }
  );
  if (!updated) return res.status(409).json({ error: 'Booking was changed by someone else. Refresh.' });

  if (STATUS_COPY[status]) {
    // 1) In-app notification, created the moment the status changes.
    try {
      await Notification.create({
        customerEmail: updated.customerEmail,
        bookingId: updated._id,
        referenceCode: updated.referenceCode,
        type: status,
        title: STATUS_COPY[status].title,
        message: notificationMessage(updated),
      });
    } catch (e) {
      console.error('Notification save failed:', e.message); // never blocks the status change
    }
    // 2) Detailed email, sent right away. Best-effort: a mail failure must
    //    never block or roll back the status change.
    const mail = statusEmail(updated);
    sendMail({ to: updated.customerEmail, ...mail })
      .catch((e) => console.error('Status email failed for ' + updated.referenceCode + ':', e.message));
  }

  res.json(updated);
}));

module.exports = router;
