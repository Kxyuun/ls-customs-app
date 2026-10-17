import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AuthFooter from '../components/AuthFooter.js';
import PasswordField from '../components/PasswordField.js';
import { API } from '../config/api.js';
import { authErrorMessage, createFirstAdminLocal, hasLocalStaffAccounts, useStaffSession } from '../utils/auth.js';
import { EMAIL_MAX, NAME_MAX, NAME_MESSAGE, PASSWORD_MESSAGE, isValidName, isValidPassword } from '../utils/validation.js';
import { usePageTitle } from '../utils/usePageTitle.js';

// Staff and admins now sign in on the shared /login page; the role comes from
// the authenticated account (server-issued in API mode). This route is kept ONLY
// for the one-time DEMO "create the first admin" step, which exists so the
// dashboard is reachable with no hardcoded user. Once any staff account exists
// (or API.LOGIN is configured) it just forwards to /login.
//
// BACKEND REQUIRED: real staff/admin accounts must be provisioned server-side.
// Remove this page and createFirstAdminLocal before launch.
function StaffLogin() {
  var session = useStaffSession();
  usePageTitle('Admin Setup — LS Customs');

  var needsSetup = !API.LOGIN && !hasLocalStaffAccounts();

  var [name, setName] = useState('');
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [error, setError] = useState('');
  var [busy, setBusy] = useState(false);
  var busyRef = useRef(false);

  if (session) return <Navigate to="/dashboard" replace />;
  if (!needsSetup) return <Navigate to="/login" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;

    if (!email.trim() || !password) {
      setError('Enter an email and password to continue.');
      return;
    }
    if (!isValidName(name)) {
      setError(NAME_MESSAGE);
      return;
    }
    if (!isValidPassword(password)) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError('');

    try {
      await createFirstAdminLocal({ name: name, email: email, password: password });
      // Session is now set; the <Navigate> above takes the user to /dashboard.
    } catch (err) {
      busyRef.current = false;
      setBusy(false);
      if (err && err.status === 409) setError('That email is already used by a customer account. Use a different email.');
      else setError(authErrorMessage(err, 'Could not create the admin account. Try again.'));
    }
  }

  return (
    <div className="auth-page">
      <main className="auth-main">
        <div className="auth-card">
          <p className="auth-eyebrow mono">STAFF SETUP (DEMO)</p>
          <h1>Create Admin</h1>
          <p className="auth-sub mono">
            No staff accounts exist on this browser yet. Create the first admin account (demo only, stored locally). Afterwards, staff and admins sign in on the normal login page.
          </p>

          <div className="auth-panel">
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="staffName">Name</label>
                <div className="field-input-wrap">
                  <input
                    id="staffName"
                    type="text"
                    name="name"
                    placeholder="FULL NAME"
                    maxLength={NAME_MAX}
                    required
                    value={name}
                    onChange={function (e) { setName(e.target.value); }}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="staffEmail">Email Address</label>
                <div className="field-input-wrap">
                  <input
                    id="staffEmail"
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
                <label htmlFor="staffPassword">Password</label>
                <PasswordField
                  id="staffPassword"
                  name="password"
                  placeholder="ENTER PASSWORD"
                  maxLength={32}
                  required
                  value={password}
                  onChange={function (e) { setPassword(e.target.value); }}
                />
                <p className="field-hint mono">{PASSWORD_MESSAGE.replace('Password must be', 'Use')}</p>
              </div>

              <p className={'booking-error mono' + (error ? ' show' : '')} role="alert">{error}</p>

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Please wait...' : 'Create Admin \u2192'}
              </button>
            </form>

            <p className="auth-switch mono"><Link to="/login">Back to login.</Link></p>
          </div>
        </div>
      </main>
      <AuthFooter />
    </div>
  );
}

export default StaffLogin;
