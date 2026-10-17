const router = require('express').Router();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { auth, requireRole } = require('../middleware/auth');
const {
  normalizeEmail, normalizeName, isValidEmail, isValidName, isValidPassword,
} = require('../utils/validation');

const shape = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// LIST (staff or admin)
router.get('/', auth, requireRole('staff', 'admin'), asyncHandler(async (req, res) => {
  const list = await User.find({ role: { $in: ['staff', 'admin'] } }).sort({ createdAt: 1 });
  res.json(list.map(shape));
}));

// CREATE (admin only)
router.post('/', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const name = normalizeName(req.body.name);
  const email = normalizeEmail(req.body.email);
  const role = req.body.role === 'admin' ? 'admin' : 'staff';
  const { password } = req.body;

  if (!isValidName(name) || !isValidEmail(email) || !isValidPassword(password)) {
    return res.status(400).json({ error: 'Invalid details' });
  }
  // One email = one role, across customers AND staff
  if (await User.exists({ email })) return res.status(409).json({ error: 'Email already in use' });

  try {
    const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json(shape(user));
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    throw e;
  }
}));

// REMOVE (admin only)
router.delete('/:id', auth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Not found' });

  const target = await User.findById(id);
  // This endpoint can only remove staff/admin accounts, never customers
  if (!target || target.role === 'customer') return res.status(404).json({ error: 'Not found' });

  if (target.id === req.user.userId) return res.status(409).json({ error: 'You cannot remove yourself' });
  if (target.role === 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) {
    return res.status(409).json({ error: 'Cannot remove the last admin' });
  }

  await target.deleteOne();
  res.status(204).end();
}));

module.exports = router;
