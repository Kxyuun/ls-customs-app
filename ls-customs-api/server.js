require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { verifyMailer } = require('./utils/mailer');

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error('Missing ' + key + ' in your .env file');
    process.exit(1);
  }
}

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1); // Render/Railway

const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// URL map (put these in the frontend's src/config/api.js):
//   LOGIN                  POST   /api/login
//   OTP_SEND               POST   /api/otp/send
//   OTP_VERIFY             POST   /api/otp/verify
//   CHANGE_PASSWORD        POST   /api/password/change
//   PASSWORD_RESET_REQUEST POST   /api/password/reset-request
//   PASSWORD_RESET_CONFIRM POST   /api/password/reset-confirm
//   CHANGE_EMAIL_VERIFY    POST   /api/email/verify-password
//   CHANGE_EMAIL_REQUEST   POST   /api/email/change-request
//   CHANGE_EMAIL_CONFIRM   POST   /api/email/change-confirm
//   PROFILE                PATCH  /api/profile
//   BOOKINGS               /api/bookings
//   NOTIFICATIONS          /api/notifications
//   STAFF_ACCOUNTS         /api/staff
//   AVAILABILITY           /api/availability
app.use('/api', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/notifications', require('./routes/notifications'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 4000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, () => {
    console.log('API running on port ' + port);
    verifyMailer();
  }))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
