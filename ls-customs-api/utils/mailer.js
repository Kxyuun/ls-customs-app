const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  const port = parseInt(process.env.SMTP_PORT, 10) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const mailEnabled = () => !!transporter;

// Emails always go out through SMTP (Gmail). If SMTP isn't configured this
// THROWS, so a missing setup is an obvious error instead of a code silently
// printed in the terminal. For offline dev only, set MAIL_CONSOLE=true in .env
// to print emails in the terminal instead.
// `html` is optional; `text` is always sent as the plain-text fallback.
async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    if (process.env.MAIL_CONSOLE === 'true') {
      console.log('\n[mail console] To: ' + to + '\nSubject: ' + subject + '\n' + text + '\n');
      return;
    }
    throw new Error('Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS in .env');
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"LS Customs" <' + process.env.SMTP_USER + '>',
    to, subject, text, html,
  });
}

// Called once at startup so a wrong App Password shows up immediately,
// not the first time a customer tries to sign up.
async function verifyMailer() {
  if (!transporter) {
    console.error('Email: SMTP is NOT configured. Codes and notifications cannot be emailed until SMTP_HOST, SMTP_USER and SMTP_PASS are set in .env.');
    return;
  }
  try {
    await transporter.verify();
    console.log('Email: SMTP connected as ' + process.env.SMTP_USER);
  } catch (e) {
    console.error('Email: SMTP login FAILED (' + e.message + '). Check SMTP_* in .env (Gmail needs an App Password).');
  }
}

module.exports = { sendMail, verifyMailer, mailEnabled };
