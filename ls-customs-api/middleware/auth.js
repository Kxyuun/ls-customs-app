const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { displayName } = require('../utils/validation');

// Verifies the Bearer token AND loads the user from the database, so a deleted
// staff account or a reset password stops working immediately.
async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not logged in' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if (user.passwordChangedAt && payload.iat * 1000 + 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ error: 'Session ended. Please log in again.' });
    }

    // Role always comes from the database, never from the client
    req.user = { userId: user.id, role: user.role, email: user.email, name: displayName(user) };
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });

module.exports = { auth, requireRole };
