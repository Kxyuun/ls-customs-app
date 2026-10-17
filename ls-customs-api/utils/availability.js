// Slot availability: counts the day's non-cancelled bookings per time slot and compares
// them to the capacity (SLOT_CAPACITY in .env, default 1 booking per slot).
const Booking = require('../models/Booking');
const { slotHoursFor, parseSlot } = require('./schedule');

const CAPACITY = Math.max(1, parseInt(process.env.SLOT_CAPACITY, 10) || 1);

// Works out open/full/closed for a date from real (non-cancelled) bookings.
async function getAvailability(dateStr) {
  const hours = slotHoursFor(dateStr);
  if (!hours) return { status: 'closed', slots: [] };

  const booked = await Booking.find({ date: dateStr, status: { $ne: 'cancelled' } }).select('timeSlot');
  const counts = {};
  booked.forEach((b) => {
    const h = parseSlot(b.timeSlot);
    if (h !== null) counts[h] = (counts[h] || 0) + 1;
  });

  const slots = hours.map((hour) => ({ hour, available: (counts[hour] || 0) < CAPACITY }));
  const status = slots.some((s) => s.available) ? 'open' : 'full';
  return { status, slots };
}

module.exports = { getAvailability, CAPACITY };
