// Password recovery: enter email -> emailed OTP code -> choose a new password.
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthVisual from '../components/AuthVisual.js';
import AuthFooter from '../components/AuthFooter.js';
import PasswordField from '../components/PasswordField.js';
import RedirectIfAuthenticated from '../components/RedirectIfAuthenticated.js';
import { API } from '../config/api.js';
import { apiRequest } from '../utils/api.js';
import { authErrorMessage, customerAccountExistsLocal, resetCustomerPasswordLocal } from '../utils/auth.js';
import { safeRedirect } from '../utils/redirect.js';
import { EMAIL_MAX, PASSWORD_MESSAGE, isValidEmail, isValidPassword, normalizeEmail } from '../utils/validation.js';
import { businessInfo } from '../data/businessInfo.js';
import { usePageTitle } from '../utils/usePageTitle.js';

var MAX_CODE_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Forgot password: 'email' -> 'reset' -> 'done'.
//
// BACKEND REQUIRED for real recovery. A server must: (1) receive the email at
// API.PASSWORD_RESET_REQUEST and, if an account exists, email a single-use,
// expiring code/link (always answering the same way, so accounts can't be
// enumerated); (2) verify that code at API.PASSWORD_RESET_CONFIRM, rate-limit
// attempts, set the new password, and end existing sessions.
//
// With no backend (API.* are null) NO email is sent. So this page runs a clearly
// labelled DEMO: the code is shown on screen (same approach as the signup demo)
// and only CUSTOMER accounts stored in this browser can be reset. It is not
// account recovery and not secure.
// ---------------------------------------------------------------------------
function ForgotForm() {
  var [searchParams] = useSearchParams();
  var safeTarget = safeRedirect(searchParams.get('redirect'));
  var navigate = useNavigate();
  var loginHref = safeTarget !== '/' ? '/login?redirect=' + encodeURIComponent(safeTarget) : '/login';

  var [screen, setScreen] = useState('email'); // 'email' | 'reset' | 'done'
  var [email, setEmail] = useState('');
  var [emailError, setEmailError] = useState('');
  var [code, setCode] = useState('');
  var [newPassword, setNewPassword] = useState('');
  var [confirmPassword, setConfirmPassword] = useState('');
  var [error, setError] = useState('');
  var [demoCode, setDemoCode] = useState(null);
  var [demoHint, setDemoHint] = useState('');
  var [busy, setBusy] = useState(false);
  var busyRef = useRef(false);
  var attemptsRef = useRef(0);

  function backToEmail(message) {
    setScreen('email');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setDemoCode(null);
    setDemoHint('');
    attemptsRef.current = 0;
    setEmailError(message || '');
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    var clean = normalizeEmail(email);

    busyRef.current = true;
    setBusy(true);
    setEmailError('');
    setError('');

    try {
      if (API.PASSWORD_RESET_REQUEST) {
        // BACKEND REQUIRED: the server sends the email. The reply never
        // reveals whether the account exists.
        await apiRequest(API.PASSWORD_RESET_REQUEST, { method: 'POST', body: { email: clean } });
        setDemoCode(null);
        setDemoHint('');
      } else if (customerAccountExistsLocal(clean)) {
        var generated = String(Math.floor(100000 + Math.random() * 900000));
        setDemoCode(generated);
        setDemoHint('Demo mode, no email is sent: your code is ' + generated);
      } else {
        setDemoCode(null);
        setDemoHint('Demo mode, no email is sent. A code only appears here when an account for this email exists on this browser.');
      }
      setEmail(clean);
      attemptsRef.current = 0;
      setScreen('reset');
    } catch (err) {
      setEmailError(err && err.status === 429
        ? 'Too many requests. Wait a moment, then try again.'
        : 'Could not send the reset request. Check your connection and try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;

    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the full 6-digit code (numbers only).');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError(PASSWORD_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      if (API.PASSWORD_RESET_CONFIRM) {
        await apiRequest(API.PASSWORD_RESET_CONFIRM, {
          method: 'POST',
          body: { email: normalizeEmail(email), code: code.trim(), newPassword: newPassword }
        });
      } else {
        if (!demoCode || code.trim() !== demoCode) {
          attemptsRef.current += 1;
          if (attemptsRef.current >= MAX_CODE_ATTEMPTS) {
            backToEmail('Too many wrong codes. Request a new code.');
          } else {
            setError("That code doesn't match. Try again.");
          }
          return;
        }
        await resetCustomerPasswordLocal(email, newPassword);
      }
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      // Password updated: go to the Login page (the user is not signed in).
      navigate(loginHref, {
        replace: true,
        state: { notice: 'Password updated! Log in with your new password.', email: normalizeEmail(email) }
      });
    } catch (err) {
      if (err && (err.status === 400 || err.status === 401 || err.status === 404 || err.status === 422)) {
        setError('That code is invalid or has expired. Request a new one.');
      } else if (err && err.status === 429) {
        setError('Too many attempts. Wait a moment, then try again.');
      } else {
        setError(authErrorMessage(err, 'Could not reset the password. Check your connection and try again.'));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <p className="auth-eyebrow mono">PASSWORD RECOVERY</p>
      <h1>{screen === 'done' ? 'Password Updated' : 'Reset Password'}</h1>
      <p className="auth-sub mono">
        {screen === 'email' && 'Enter the email you registered with.'}
        {screen === 'reset' && 'Enter the 6-digit code and choose a new password.'}
        {screen === 'done' && 'You can now log in with your new password.'}
      </p>

      {screen === 'email' && (
        <div className="auth-panel">
          <form onSubmit={handleEmailSubmit} noValidate>
            <div className="field">
              <label htmlFor="forgotEmail">Email Address</label>
              <div className="field-input-wrap">
                <input
                  id="forgotEmail"
                  type="email"
                  name="email"
                  placeholder="ENTER EMAIL"
                  maxLength={EMAIL_MAX}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={function (e) { setEmail(e.target.value); }}
                />
              </div>
            </div>

            <p className={'booking-error mono' + (emailError ? ' show' : '')} role="alert">{emailError}</p>

            <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Please wait...' : 'Send Reset Code \u2192'}</button>
          </form>

          <p className="auth-switch mono"><Link to={loginHref}>&larr; Back to Login</Link></p>
        </div>
      )}

      {screen === 'reset' && (
        <div className="auth-panel">
          <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '12px', marginBottom: '20px' }}>
            If an account exists for <span style={{ color: 'var(--yellow)' }}>{email}</span>, a reset code was sent.{' '}
            <button type="button" className="link-btn" onClick={function () { backToEmail(''); }}>Wrong email? Change it</button>
          </p>

          <form onSubmit={handleResetSubmit}>
            <div className="field">
              <label htmlFor="resetCode">Reset Code</label>
              <div className="field-input-wrap">
                <input
                  id="resetCode"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={function (e) { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                />
              </div>
              {demoHint && <p className="field-hint mono">{demoHint}</p>}
            </div>

            <div className="field">
              <label htmlFor="resetNewPassword">New Password</label>
              <PasswordField
                id="resetNewPassword"
                name="new_password"
                placeholder="NEW PASSWORD"
                minLength={8}
                maxLength={32}
                required
                value={newPassword}
                onChange={function (e) { setNewPassword(e.target.value); }}
              />
              <p className="field-hint mono">8-32 characters, at least one letter and one number.</p>
            </div>

            <div className="field">
              <label htmlFor="resetConfirmPassword">Confirm New Password</label>
              <PasswordField
                id="resetConfirmPassword"
                name="confirm_new_password"
                placeholder="CONFIRM NEW PASSWORD"
                minLength={8}
                maxLength={32}
                required
                value={confirmPassword}
                onChange={function (e) { setConfirmPassword(e.target.value); }}
              />
            </div>

            <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>

            <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Updating...' : 'Update Password'}</button>
          </form>

          <p className="auth-switch mono"><Link to={loginHref}>&larr; Back to Login</Link></p>
        </div>
      )}

      {screen === 'done' && (
        <div className="auth-panel">
          <Link to={loginHref} className="auth-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Back to Login &rarr;</Link>
        </div>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  usePageTitle('Reset Password — LS Customs');

  return (
    <RedirectIfAuthenticated>
      <div className="auth-page">
        <header className="auth-topbar">
          <div className="container">
            <div className="brand">
              <div className="brand-mark"><span></span></div>
              <div className="brand-name">LS <span className="yellow">CUSTOMS</span></div>
              <div className="brand-est mono">EST. {businessInfo.established}</div>
            </div>
          </div>
        </header>

        <div className="auth-split">
          <AuthVisual />
          <div className="auth-form-col">
            <ForgotForm />
          </div>
        </div>

        <AuthFooter />
      </div>
    </RedirectIfAuthenticated>
  );
}
