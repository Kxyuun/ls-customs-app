// One-time script that creates the first admin account (npm run seed).
// Creates the first admin account. Run once with:  npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { isValidPassword } = require('./utils/validation');

(async () => {
  const email = (process.env.ADMIN_EMAIL || 'admin@lscustoms.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin12345';
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!isValidPassword(password)) {
    console.error('ADMIN_PASSWORD must be 8-32 characters with a letter and a number.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  if (await User.exists({ email })) {
    console.log('Admin already exists: ' + email);
  } else {
    await User.create({ email, name, role: 'admin', passwordHash: await bcrypt.hash(password, 10) });
    console.log('Admin created: ' + email + ' / ' + password + '  (change this password!)');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
