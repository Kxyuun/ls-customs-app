import { useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import AuthVisual from '../components/AuthVisual.js';
import AuthFooter from '../components/AuthFooter.js';
import PasswordField from '../components/PasswordField.js';
import RedirectIfAuthenticated from '../components/RedirectIfAuthenticated.js';
import { authErrorMessage, login } from '../utils/auth.js';
import { safeRedirect } from '../utils/redirect.js';
import { EMAIL_MAX } from '../utils/validation.js';
import { businessInfo } from '../data/businessInfo.js';
import { usePageTitle } from '../utils/usePageTitle.js';

function LoginForm() {
  var [searchParams] = useSearchParams();
  var redirectParam = searchParams.get('redirect');
  // Only ever a validated internal route; '/' when the param is missing/unsafe.
  var safeTarget = safeRedirect(redirectParam);

  // Set by Signup / Forgot Password after they finish: a success message and the email to prefill.
  var location = useLocation();
  var fromState = (location.state && typeof location.state === 'object') ? location.state : {};
  var notice = typeof fromState.notice === 'string' ? fromState.notice : '';

  var [email, setEmail] = useState(typeof fromState.email === 'string' ? fromState.email : '');
  var [password, setPassword] = useState('');
  var [error, setError] = useState('');
  var [busy, setBusy] = useState(false);
  var busyRef = useRef(false);

  var forgotHref = safeTarget !== '/'
    ? '/forgot-password?redirect=' + encodeURIComponent(safeTarget)
    : '/forgot-password';

  var registerHref = safeTarget !== '/'
    ? '/signup?redirect=' + encodeURIComponent(safeTarget)
    : '/signup';

  async function handleSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      // ONE login for every role. On success a session exists and
      // <RedirectIfAuthenticated> sends the user by ROLE: customers to the safe
      // redirect target, staff/admin to /dashboard. The user never picks a role.
      await login(email, password);
    } catch (err) {
      busyRef.current = false;
      setBusy(false);
      if (err && err.status === 401) setError('Invalid email or password.');
      else setError(authErrorMessage(err, 'Could not sign in. Check your connection and try again.'));
    }
  }

  return (
    <div className="auth-card">
      <p className="auth-eyebrow mono">ACCOUNT LOGIN</p>
      <h1>Welcome Back</h1>
      <p className="auth-sub mono">Sign in to your LS Customs account.</p>
      {notice && <p className="field-hint mono" role="status" style={{ color: 'var(--green)' }}>{notice}</p>}

      <div className="auth-panel">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="loginEmail">Email Address</label>
            <div className="field-input-wrap">
              <input
                id="loginEmail"
                type="email"
                name="email"
                placeholder="ENTER EMAIL"
                maxLength={EMAIL_MAX}
                required
                value={email}
                onChange={function (e) { setEmail(e.target.value); }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="loginPassword">Password</label>
            <PasswordField
              id="loginPassword"
              name="password"
              placeholder="ENTER PASSWORD"
              minLength={8}
              maxLength={32}
              required
              value={password}
              onChange={function (e) { setPassword(e.target.value); }}
            />
            <p className="field-hint mono" style={{ textAlign: 'right' }}>
              <Link to={forgotHref} className="link-btn" id="forgotLink">Forgot Password?</Link>
            </p>
          </div>

          <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>

          <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Logging in...' : 'Login \u2192'}</button>
        </form>

        <p className="auth-switch mono">Need an account? <Link to={registerHref} id="registerLink">Register here.</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  usePageTitle('Login — LS Customs');

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
            <LoginForm />
          </div>
        </div>

        <AuthFooter />
      </div>
    </RedirectIfAuthenticated>
  );
}
