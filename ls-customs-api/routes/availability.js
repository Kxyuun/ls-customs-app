// Availability route: tells the booking calendar which time slots are open, full or closed for a date.
const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { getAvailability } = require('../utils/availability');
const { isValidDateString } = require('../utils/schedule');

// GET /api/availability?date=YYYY-MM-DD  (public: the calendar needs it)
router.get('/', asyncHandler(async (req, res) => {
  const date = String(req.query.date || '');
  if (!isValidDateString(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  res.json(await getAvailability(date));
}));

module.exports = router;
