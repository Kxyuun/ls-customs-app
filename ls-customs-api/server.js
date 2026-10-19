// LS Customs API entry point: loads .env settings, connects to MongoDB, mounts the REST routes
// (/api/...) and starts the Express server. Run with `npm run dev` (or `npm start`).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { verifyMailer } = require('./utils/mailer');

// Fail fast if a required setting is missing from .env.
for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error('Missing ' + key + ' in your .env file');
    process.exit(1);
  }
}

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1); // Render/Railway

// CORS: only the listed frontend origin(s) may call this API.
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

// Health check used to confirm the API is running.
app.get('/api/health', (req, res) => res.json({ ok: true }));


// Route modules (one file per resource).
app.use('/api', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/notifications', require('./routes/notifications'));

// Fallback handlers: unknown route -> 404, any uncaught error -> JSON error response.
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// Start listening only after the database connection succeeds.
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
