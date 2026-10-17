import { useCallback, useEffect, useRef, useState } from 'react';
import Header from '../components/Header.js';
import Footer from '../components/Footer.js';
import RequireCustomerAuth from '../components/RequireCustomerAuth.js';
import PasswordField from '../components/PasswordField.js';
import { API } from '../config/api.js';
import { authErrorMessage, changeCustomerPassword, confirmEmailChange, requestEmailChange, updateCustomerProfile, useCustomerSession, verifyEmailChangePassword } from '../utils/auth.js';
import { listNotifications, markNotificationRead, subscribeNotifications } from '../utils/notificationsStore.js';
import { listBookings, subscribeBookings, updateBookingStatus } from '../utils/bookingsStore.js';
import { STATUS_LABELS, customerCanCancel } from '../utils/bookingStatus.js';
import { formatEstimatedTotal } from '../utils/pricing.js';
import { EMAIL_MAX, NAME_MAX, NAME_MESSAGE, PASSWORD_MESSAGE, isValidEmail, isValidName, isValidPassword, normalizeEmail, normalizeName } from '../utils/validation.js';
import { usePageTitle } from '../utils/usePageTitle.js';
import { useLiveRefresh } from '../utils/useLiveRefresh.js';

// How often the page re-checks the server, so a status change the shop just
// made (and its notification) shows up without a manual reload.
var REFRESH_MS = 15000;

function MyBookings({ customer }) {
  var [state, setState] = useState({ status: 'loading', bookings: [] });
  var [busyId, setBusyId] = useState(null);
  var [actionError, setActionError] = useState('');

  var load = useCallback(function (silent) {
    if (!silent) setState({ status: 'loading', bookings: [] });
    return listBookings({ customerEmail: customer.email, token: customer.token }).then(function (bookings) {
      setState({ status: 'ready', bookings: bookings });
    }).catch(function () {
      setState({ status: 'error', bookings: [] });
    });
  }, [customer.email, customer.token]);

  useEffect(function () {
    load(false);
    // Same store as the staff Dashboard: status changes made there show up here.
    return subscribeBookings(function () { load(true); });
  }, [load]);

  useLiveRefresh(!!API.BOOKINGS, useCallback(function () { load(true); }, [load]), REFRESH_MS);

  async function handleCancel(booking) {
    if (busyId) return;
    if (!window.confirm('Cancel booking ' + booking.referenceCode + '?')) return;
    setBusyId(booking.id);
    setActionError('');
    try {
      await updateBookingStatus(booking.id, 'cancelled', { customerEmail: customer.email, token: customer.token });
      await load(true);
    } catch (err) {
      setActionError("Couldn't cancel that booking. It may have already been updated.");
      load(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="booking-panel" style={{ marginTop: '30px' }}>
      <h2 className="booking-step-title">My Bookings</h2>

      {state.status === 'loading' && <p className="booking-step-sub">Loading your bookings...</p>}
      {state.status === 'error' && (
        <div>
          <p className="booking-error mono show" role="alert">Could not load your bookings.</p>
          <button type="button" className="btn btn-outline" onClick={function () { load(false); }}>Try again</button>
        </div>
      )}
      {state.status === 'ready' && state.bookings.length === 0 && (
        <p className="booking-step-sub">You have no bookings yet.</p>
      )}
      {state.status === 'ready' && state.bookings.length > 0 && (
        <p className="booking-step-sub">{API.BOOKINGS ? 'Your bookings. Status updates appear here automatically.' : 'Bookings made on this browser (demo storage, not yet synced to a server).'}</p>
      )}
      {actionError && <p className="booking-error mono show" role="alert">{actionError}</p>}

      {state.bookings.map(function (b) {
        return (
          <div className="summary-list" key={b.id} style={{ marginTop: '20px' }}>
            <div className="summary-row"><span>Reference</span><span className="mono">{b.referenceCode}</span></div>
            <div className="summary-row"><span>Service(s)</span><span>{(b.services || []).join(', ')}</span></div>
            <div className="summary-row"><span>Vehicle</span><span>{b.vehicle}</span></div>
            <div className="summary-row"><span>Date &amp; Time</span><span>{b.date} &middot; {b.timeSlot}</span></div>
            <div className="summary-row"><span>Estimated Total</span><span>{formatEstimatedTotal(b.totalEstimate)}</span></div>
            <div className="summary-row">
              <span>Status</span>
              <span className={'status-pill mono st-' + b.status}>{STATUS_LABELS[b.status] || b.status}</span>
            </div>
            {customerCanCancel(b.status) && (
              <div className="booking-nav" style={{ marginTop: '12px' }}>
                <span></span>
                <button type="button" className="btn btn-outline" disabled={busyId === b.id} onClick={function () { handleCancel(b); }}>
                  {busyId === b.id ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Notifications({ customer }) {
  var [state, setState] = useState({ status: 'loading', items: [] });
  var [busy, setBusy] = useState(false);

  var load = useCallback(function () {
    return listNotifications({ customerEmail: customer.email, token: customer.token }).then(function (items) {
      setState({ status: 'ready', items: items });
    }).catch(function () {
      setState({ status: 'error', items: [] });
    });
  }, [customer.email, customer.token]);

  useEffect(function () {
    load();
    return subscribeNotifications(function () { load(); });
  }, [load]);

  useLiveRefresh(!!API.NOTIFICATIONS, load, REFRESH_MS);

  async function handleRead(item) {
    if (busy) return;
    setBusy(true);
    try {
      await markNotificationRead(item.id, { customerEmail: customer.email, token: customer.token });
    } catch (err) { /* the list reload below shows the real state */ }
    await load();
    setBusy(false);
  }

  var unread = state.items.filter(function (n) { return !n.read; }).length;

  return (
    <div className="booking-panel" style={{ marginTop: '30px' }}>
      <h2 className="booking-step-title">Notifications{unread > 0 ? ' (' + unread + ' new)' : ''}</h2>
      <p className="field-hint mono">
        {API.NOTIFICATIONS
          ? 'Updates from the shop about your bookings. A copy is also emailed to you.'
          : 'Demo: these appear here only, on this browser. No email, SMS or push message is sent. Real notification delivery needs a backend.'}
      </p>

      {state.status === 'loading' && <p className="booking-step-sub">Loading notifications...</p>}
      {state.status === 'error' && (
        <div>
          <p className="booking-error mono show" role="alert">Could not load notifications.</p>
          <button type="button" className="btn btn-outline" onClick={load}>Try again</button>
        </div>
      )}
      {state.status === 'ready' && state.items.length === 0 && (
        <p className="booking-step-sub">No notifications yet. You'll see an update here (and get an email) when your booking is in progress, ready for pickup, completed or cancelled.</p>
      )}

      {state.status === 'ready' && state.items.map(function (n) {
        return (
          <div className="summary-list" key={n.id} style={{ marginTop: '14px' }}>
            <div className="summary-row">
              <span>{n.read ? 'Read' : 'New'}</span>
              <span>{n.message}</span>
            </div>
            <div className="summary-row">
              <span>Booking</span>
              <span className="mono">{n.referenceCode} &middot; {n.createdAt ? new Date(n.createdAt).toLocaleString('en-PH') : ''}</span>
            </div>
            {!n.read && (
              <div className="booking-nav" style={{ marginTop: '10px' }}>
                <span></span>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={function () { handleRead(n); }}>Mark as read</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// "Change Email" lives inside the Profile box. It is one button that opens a
// short 3-step flow: (1) enter your password, (2) type the new email and send
// a code to it, (3) enter the code. The email only changes after step 3.
function ChangeEmail({ customer }) {
  var [step, setStep] = useState('idle'); // 'idle' | 'password' | 'email' | 'code'
  var [newEmail, setNewEmail] = useState('');
  var [password, setPassword] = useState('');
  var [code, setCode] = useState('');
  var [error, setError] = useState('');
  var [info, setInfo] = useState('');
  var [busy, setBusy] = useState(false);
  var busyRef = useRef(false);

  var enabled = !!(API.CHANGE_EMAIL_VERIFY && API.CHANGE_EMAIL_REQUEST && API.CHANGE_EMAIL_CONFIRM) && customer.mode === 'api';

  function close() {
    setStep('idle'); setNewEmail(''); setPassword(''); setCode(''); setError(''); setInfo('');
  }

  function messageFor(err, fallback) {
    var st = err && err.status;
    if (st === 401) return step === 'password' || step === 'email' ? 'Your password is incorrect.' : 'Your session ended. Log in again.';
    if (st === 409) return 'That email is already in use. Try a different one.';
    if (st === 429) return 'Too many requests. Wait a few minutes and try again.';
    if (st === 400 && step === 'code') return 'That code is wrong or expired. Check the newest email or send a new code.';
    if (st === 501) return 'Changing your email needs the server, which is not connected.';
    return authErrorMessage(err, fallback);
  }

  // Step 1 -> 2: check the password with the server before asking for a new email.
  async function checkPassword(e) {
    e.preventDefault();
    if (busyRef.current) return;
    if (!password) { setError('Enter your current password to continue.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      await verifyEmailChangePassword(password);
      setStep('email');
    } catch (err) {
      setError(messageFor(err, "Couldn't check your password. Try again."));
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  // Step 2 -> 3: email a code to the NEW address.
  async function sendCode(e) {
    if (e) e.preventDefault();
    if (busyRef.current) return;
    var target = normalizeEmail(newEmail);
    if (!isValidEmail(target)) { setError('Enter a valid email address.'); return; }
    if (target === customer.email) { setError('That is already your email.'); return; }

    busyRef.current = true; setBusy(true); setError(''); setInfo('');
    try {
      await requestEmailChange(target, password);
      setNewEmail(target);
      setStep('code');
      setInfo('We sent a 6-digit code to ' + target + '. It expires in 10 minutes.');
    } catch (err) {
      setError(messageFor(err, "Couldn't send the code. Try again."));
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    if (busyRef.current) return;
    var clean = code.trim();
    if (!/^\d{6}$/.test(clean)) { setError('Enter the full 6-digit code (numbers only).'); return; }

    busyRef.current = true; setBusy(true); setError('');
    try {
      // On success the session switches to the new email and this page reloads
      // its data for it, so there is nothing more to do here.
      await confirmEmailChange(newEmail, clean);
      setPassword('');
    } catch (err) {
      setError(messageFor(err, "Couldn't confirm the code. Try again."));
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  return (
    <div className="booking-field" style={{ marginTop: '4px' }}>
      <label htmlFor="acctEmail">Email</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input id="acctEmail" type="email" maxLength={EMAIL_MAX} readOnly value={customer.email} style={{ flex: '1 1 240px' }} />
        {step === 'idle' && (
          <button type="button" className="btn btn-outline" disabled={!enabled}
            title={enabled ? '' : 'Needs the server (not available in demo mode)'}
            onClick={function () { setStep('password'); }}>Change Email</button>
        )}
      </div>
      {!enabled && step === 'idle' && <p className="field-hint mono">Changing your email needs the server, which is not connected in demo mode.</p>}

      {enabled && step === 'password' && (
        <form onSubmit={checkPassword} style={{ marginTop: '14px' }}>
          <p className="field-hint mono">Step 1 of 3. Enter your password to continue.</p>
          <div className="field">
            <label htmlFor="acctEmailPassword">Current Password</label>
            <PasswordField id="acctEmailPassword" name="email_change_password" placeholder="CURRENT PASSWORD" maxLength={32} required value={password}
              onChange={function (e) { setPassword(e.target.value); setError(''); }} />
          </div>
          <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>
          <div className="booking-nav">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-yellow" disabled={busy}>{busy ? 'Checking...' : 'Continue'}</button>
          </div>
        </form>
      )}

      {enabled && step === 'email' && (
        <form onSubmit={sendCode} style={{ marginTop: '14px' }}>
          <p className="field-hint mono">Step 2 of 3. Type your new email. We will send a verification code to it.</p>
          <div className="field">
            <label htmlFor="acctNewEmail">New Email</label>
            <input id="acctNewEmail" type="email" placeholder="NEW EMAIL ADDRESS" maxLength={EMAIL_MAX} autoComplete="email" required value={newEmail}
              onChange={function (e) { setNewEmail(e.target.value); setError(''); }} />
          </div>
          <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>
          <div className="booking-nav">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-yellow" disabled={busy}>{busy ? 'Sending...' : 'Send Verification Code'}</button>
          </div>
        </form>
      )}

      {enabled && step === 'code' && (
        <form onSubmit={confirm} style={{ marginTop: '14px' }}>
          <p className="field-hint mono">Step 3 of 3.</p>
          {info && <p className="field-hint mono" role="status">{info}</p>}
          <div className="field">
            <label htmlFor="acctEmailCode">6-digit code</label>
            <input id="acctEmailCode" type="text" placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code}
              onChange={function (e) { setCode(e.target.value.replace(/\D/g, '')); setError(''); }} />
          </div>
          <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>
          <div className="booking-nav">
            <button type="button" className="btn btn-outline" disabled={busy} onClick={function () { setStep('email'); setCode(''); setError(''); setInfo(''); }}>Use a different email</button>
            <span>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={function () { sendCode(); }} style={{ marginRight: '8px' }}>Resend Code</button>
              <button type="submit" className="btn btn-yellow" disabled={busy}>{busy ? 'Confirming...' : 'Confirm Email'}</button>
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

function ChangePassword() {
  var [current, setCurrent] = useState('');
  var [next, setNext] = useState('');
  var [confirm, setConfirm] = useState('');
  var [error, setError] = useState('');
  var [done, setDone] = useState(false);
  var [busy, setBusy] = useState(false);
  var busyRef = useRef(false);

  function edit(setter) {
    return function (e) { setter(e.target.value); setDone(false); };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;
    setDone(false);

    if (!current) { setError('Enter your current password.'); return; }
    if (!isValidPassword(next)) { setError(PASSWORD_MESSAGE); return; }
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    if (next === current) { setError('Choose a new password that is different from the current one.'); return; }

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      await changeCustomerPassword(current, next);
      // Never keep passwords in state longer than needed.
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      if (err && err.status === 401) setError('Your current password is incorrect.');
      else if (err && err.status === 501) setError('Changing your password needs the server, which is not connected yet.');
      else setError(authErrorMessage(err, "Couldn't change your password. Try again."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="booking-panel" style={{ marginTop: '30px' }}>
      <h2 className="booking-step-title">Change Password</h2>
      <p className="field-hint mono">
        {API.CHANGE_PASSWORD
          ? 'Your new password takes effect on your next login.'
          : 'Demo only: this updates the login stored on this browser. It is not real account security. Updating a real password needs a backend.'}
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
        <div className="field">
          <label htmlFor="acctCurrentPassword">Current Password</label>
          <PasswordField id="acctCurrentPassword" name="current_password" placeholder="CURRENT PASSWORD" maxLength={32} required value={current} onChange={edit(setCurrent)} />
        </div>
        <div className="field">
          <label htmlFor="acctNewPassword">New Password</label>
          <PasswordField id="acctNewPassword" name="new_password" placeholder="NEW PASSWORD" minLength={8} maxLength={32} required value={next} onChange={edit(setNext)} />
          <p className="field-hint mono">8-32 characters, at least one letter and one number.</p>
        </div>
        <div className="field">
          <label htmlFor="acctConfirmPassword">Confirm New Password</label>
          <PasswordField id="acctConfirmPassword" name="confirm_new_password" placeholder="CONFIRM NEW PASSWORD" minLength={8} maxLength={32} required value={confirm} onChange={edit(setConfirm)} />
        </div>

        <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>
        {done && <p className="field-hint mono" role="status" style={{ color: 'var(--green)' }}>Password updated{API.CHANGE_PASSWORD ? '.' : ' on this browser (demo).'}</p>}

        <div className="booking-nav">
          <span></span>
          <button type="submit" className="btn btn-yellow" disabled={busy}>{busy ? 'Updating...' : 'Update Password'}</button>
        </div>
      </form>
    </div>
  );
}

function AccountForm({ customer }) {
  var [firstName, setFirstName] = useState(customer.firstName);
  var [lastName, setLastName] = useState(customer.lastName);
  var [error, setError] = useState(false);
  var [saved, setSaved] = useState(false);
  var [saveFailed, setSaveFailed] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    setSaveFailed(false);

    if (!isValidName(firstName) || !isValidName(lastName)) {
      setError(true);
      return;
    }
    setError(false);

    var f = normalizeName(firstName);
    var l = normalizeName(lastName);
    var ok = await updateCustomerProfile(f, l);
    if (!ok) { setSaveFailed(true); return; }
    setFirstName(f);
    setLastName(l);
    setSaved(true);
  }

  return (
    <main className="booking-page">
      <div className="container">
        <div className="booking-head">
          <p className="auth-eyebrow mono">Your account</p>
          <h1>My Account</h1>
        </div>

        <div className="booking-panel">
          <h2 className="booking-step-title">Profile</h2>
          <p className="booking-step-sub">Update your details below.</p>

          <form id="profileForm" onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="booking-field">
                <label htmlFor="acctFirst">First Name</label>
                <input
                  id="acctFirst"
                  type="text"
                  maxLength={NAME_MAX}
                  value={firstName}
                  onChange={function (e) { setFirstName(e.target.value); setSaved(false); }}
                />
              </div>
              <div className="booking-field">
                <label htmlFor="acctLast">Last Name</label>
                <input
                  id="acctLast"
                  type="text"
                  maxLength={NAME_MAX}
                  value={lastName}
                  onChange={function (e) { setLastName(e.target.value); setSaved(false); }}
                />
              </div>
            </div>
          </form>

          {/* Email + the Change Email button/flow sit in the same box (outside the form: forms can't nest). */}
          <ChangeEmail customer={customer} />

          <p className={'booking-error mono' + (error ? ' show' : '')}>{NAME_MESSAGE}</p>
          {saved && <p className="field-hint mono" role="status" style={{ color: 'var(--green)' }}>{API.PROFILE ? 'Saved.' : 'Saved on this browser (demo storage, no backend yet).'}</p>}
          {saveFailed && <p className="booking-error mono show" role="alert">Could not save your changes. Try again.</p>}

          <div className="booking-nav">
            <span></span>
            <button type="submit" form="profileForm" className="btn btn-yellow">Save Changes</button>
          </div>
        </div>

        <ChangePassword />

        <Notifications customer={customer} />

        <MyBookings customer={customer} />
      </div>
    </main>
  );
}

function AccountRoute() {
  var session = useCustomerSession();
  return session ? <AccountForm key={session.email} customer={session} /> : null;
}

function Account() {
  usePageTitle('My Account — LS Customs');

  return (
    <RequireCustomerAuth>
      <Header variant="account" />
      <AccountRoute />
      <Footer />
    </RequireCustomerAuth>
  );
}

export default Account;