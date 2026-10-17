// Customer notifications. Customers can only list and mark as read their own
// notifications (the email filter is the ownership check).
const router = require('express').Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, requireRole('customer'), asyncHandler(async (req, res) => {
  res.json(await Notification.find({ customerEmail: req.user.email }).sort({ createdAt: -1 }));
}));

router.patch('/:id', auth, requireRole('customer'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  // Filtering by the customer's email is the ownership check
  const updated = await Notification.findOneAndUpdate(
    { _id: req.params.id, customerEmail: req.user.email },
    { read: true },
    { new: true }
  );
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
}));

module.exports = router;
