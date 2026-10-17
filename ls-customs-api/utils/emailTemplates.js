// Plain, table-based HTML that renders in Gmail/Outlook, plus a text fallback.
const SHOP = {
  name: 'LS Customs',
  address: process.env.SHOP_ADDRESS || '123 Pickup Coffee, Pasay City, PH',
  phone: process.env.SHOP_PHONE || '+63 917 676 6767',
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH');

const STATUS_LABELS = {
  pending: 'Pending',
  progress: 'In Progress',
  ready: 'Ready for Pickup',
  done: 'Completed',
  cancelled: 'Cancelled',
};

// Headline + one-sentence explanation for each status a customer is told about.
const STATUS_COPY = {
  progress: {
    title: 'We started working on your vehicle',
    body: 'Our technicians have started on your booking. We will message you again when it is ready.',
  },
  ready: {
    title: 'Your vehicle is ready for pickup',
    body: 'The work is finished. You can pick up your vehicle during shop hours.',
  },
  done: {
    title: 'Your booking is completed',
    body: 'Thank you for choosing LS Customs. We hope to see you again.',
  },
  cancelled: {
    title: 'Your booking was cancelled',
    body: 'This booking has been cancelled. You can book a new slot any time.',
  },
};

function layout(title, intro, rows, footer) {
  const rowsHtml = rows.map(([k, v]) =>
    '<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">' + esc(k) +
    '</td><td style="padding:6px 0;color:#111"><strong>' + esc(v) + '</strong></td></tr>').join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">' +
    '<div style="font-size:12px;letter-spacing:2px;color:#b8860b;font-weight:bold">' + esc(SHOP.name.toUpperCase()) + '</div>' +
    '<h2 style="margin:8px 0 12px">' + esc(title) + '</h2>' +
    '<p style="margin:0 0 16px;line-height:1.5">' + esc(intro) + '</p>' +
    (rows.length ? '<table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">' + rowsHtml + '</table>' : '') +
    '<p style="font-size:12px;color:#666;line-height:1.5;margin:16px 0 0">' + footer + '</p></div>';
}

const shopFooterHtml = () => esc(SHOP.name + ' · ' + SHOP.address + ' · ' + SHOP.phone);

function bookingRows(b) {
  const services = (b.services && b.services.length ? b.services : [b.baseService].concat(b.additionalServices || []))
    .filter(Boolean).join(', ');
  return [
    ['Reference', b.referenceCode],
    ['Status', STATUS_LABELS[b.status] || b.status],
    ['Service(s)', services],
    ['Vehicle', b.vehicle],
    ['Date & time', b.date + ' at ' + b.timeSlot],
    ['Payment', b.payment],
    ['Estimated total', b.totalEstimate === 0 ? 'To be discussed' : peso(b.totalEstimate)],
  ];
}

// Short in-app notification text (also used as the email subject line tail).
function notificationMessage(b) {
  const c = STATUS_COPY[b.status];
  if (!c) return null;
  const services = (b.services && b.services.length ? b.services : [b.baseService]).filter(Boolean).join(', ');
  return c.title + '. ' + b.referenceCode + ' · ' + services + ' · ' + b.vehicle + ' · ' +
    b.date + ' ' + b.timeSlot + '.';
}

function statusEmail(b) {
  const c = STATUS_COPY[b.status];
  if (!c) return null;
  const rows = bookingRows(b);
  const text = c.title + '\n\n' + c.body + '\n\n' +
    rows.map(([k, v]) => k + ': ' + v).join('\n') + '\n\n' +
    SHOP.name + ' - ' + SHOP.address + ' - ' + SHOP.phone;
  return {
    subject: 'LS Customs ' + b.referenceCode + ': ' + (STATUS_LABELS[b.status] || b.status),
    text,
    html: layout(c.title, c.body, rows, shopFooterHtml()),
  };
}

const CODE_COPY = {
  signup: { subject: 'Your LS Customs verification code', title: 'Verify your email', intro: 'Use this code to finish creating your LS Customs account.' },
  reset: { subject: 'Your LS Customs password reset code', title: 'Reset your password', intro: 'Use this code to choose a new password.' },
  'email-change': { subject: 'Confirm your new LS Customs email', title: 'Confirm your new email', intro: 'Use this code to confirm this address as the email for your LS Customs account.' },
};

function codeEmail(purpose, code, minutes) {
  const c = CODE_COPY[purpose];
  const text = c.title + '\n\n' + c.intro + '\n\nYour code: ' + code + '\nIt expires in ' + minutes +
    ' minutes. If you did not request it, ignore this email.';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">' +
    '<div style="font-size:12px;letter-spacing:2px;color:#b8860b;font-weight:bold">LS CUSTOMS</div>' +
    '<h2 style="margin:8px 0 12px">' + esc(c.title) + '</h2>' +
    '<p style="margin:0 0 16px;line-height:1.5">' + esc(c.intro) + '</p>' +
    '<div style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f4f4f4;padding:16px;text-align:center;border-radius:6px">' + esc(code) + '</div>' +
    '<p style="font-size:12px;color:#666;line-height:1.5;margin-top:16px">This code expires in ' + minutes +
    ' minutes. If you did not request it, you can ignore this email.</p></div>';
  return { subject: c.subject, text, html };
}

function emailChangedNoticeEmail(oldEmail, newEmail) {
  const text = 'The email on your LS Customs account was changed from ' + oldEmail + ' to ' + newEmail +
    '.\n\nIf this was not you, contact the shop right away: ' + SHOP.phone;
  return {
    subject: 'Your LS Customs email was changed',
    text,
    html: layout('Your account email was changed',
      'The email on your LS Customs account was changed from ' + oldEmail + ' to ' + newEmail + '.',
      [], 'If this was not you, contact the shop right away: ' + esc(SHOP.phone)),
  };
}

module.exports = { statusEmail, notificationMessage, codeEmail, emailChangedNoticeEmail, STATUS_COPY };
