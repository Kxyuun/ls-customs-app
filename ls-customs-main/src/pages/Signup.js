// Customer signup: details form -> emailed OTP code -> account created, then the customer logs in.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthVisual from '../components/AuthVisual.js';
import AuthFooter from '../components/AuthFooter.js';
import PasswordField from '../components/PasswordField.js';
import RedirectIfAuthenticated from '../components/RedirectIfAuthenticated.js';
import ConfirmDialog from '../components/ConfirmDialog.js';
import { API } from '../config/api.js';
import { apiRequest } from '../utils/api.js';
import { authErrorMessage, customerEmailTaken, registerCustomerLocal } from '../utils/auth.js';
import { safeRedirect } from '../utils/redirect.js';
import { EMAIL_MAX, NAME_MAX, NAME_MESSAGE, PASSWORD_MESSAGE, isValidName, isValidPassword, normalizeEmail, normalizeName } from '../utils/validation.js';
import { businessInfo } from '../data/businessInfo.js';
import { usePageTitle } from '../utils/usePageTitle.js';

var RESEND_COOLDOWN_SECONDS = 30;

function SignupForm() {
  var [searchParams] = useSearchParams();
  var safeTarget = safeRedirect(searchParams.get('redirect'));
  var navigate = useNavigate();

  var [screen, setScreen] = useState('form'); // 'form' | 'otp'

  var [firstName, setFirstName] = useState('');
  var [lastName, setLastName] = useState('');
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [confirmPassword, setConfirmPassword] = useState('');

  var [nameError, setNameError] = useState(false);
  var [emailError, setEmailError] = useState('');
  // Pop-up shown when the typed email already has an account.
  var [takenEmail, setTakenEmail] = useState('');
  var [passwordError, setPasswordError] = useState('');

  var [otp, setOtp] = useState('');
  var [otpError, setOtpError] = useState('');
  var [otpInfo, setOtpInfo] = useState('');
  var [demoOtp, setDemoOtp] = useState(null);
  var [demoHint, setDemoHint] = useState('');
  var [verifying, setVerifying] = useState(false);
  var [sending, setSending] = useState(false);
  var [cooldown, setCooldown] = useState(0);
  var verifyingRef = useRef(false);
  var sendingRef = useRef(false);

  var loginHref = safeTarget !== '/'
    ? '/login?redirect=' + encodeURIComponent(safeTarget)
    : '/login';

  // Resend cooldown countdown.
  useEffect(function () {
    if (cooldown <= 0) return undefined;
    var id = setTimeout(function () { setCooldown(function (c) { return c - 1; }); }, 1000);
    return function () { clearTimeout(id); };
  }, [cooldown]);

  function handleNameChange(setter) {
    return function (e) { setter(e.target.value.replace(/[^\p{L}\s'.-]/gu, '')); };
  }

  // Sends (or re-sends) the code. Local demo mode generates one on screen;
  // API mode posts to API.OTP_SEND and treats any non-OK response as failure.
  // Returns 'sent', 'taken' (the email already has an account) or 'failed'.
  async function sendOtp(targetEmail, isResend) {
    if (sendingRef.current) return 'failed';
    sendingRef.current = true;
    setSending(true);
    setOtpError('');
    setOtpInfo('');

    try {
      if (!API.OTP_SEND) {
        var code = String(Math.floor(100000 + Math.random() * 900000));
        setDemoOtp(code);
        setDemoHint('Demo mode, no email backend yet: your code is ' + code);
      } else {
        setDemoHint('');
        await apiRequest(API.OTP_SEND, { method: 'POST', body: { email: targetEmail } });
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      if (isResend) setOtpInfo('A new code was sent to ' + targetEmail + '.');
      return 'sent';
    } catch (err) {
      if (err && err.status === 409) return 'taken';
      setOtpError(err && err.status === 429
        ? 'Too many requests. Wait a moment, then try Resend.'
        : 'Could not send the code. Check your connection and try Resend.');
      return 'failed';
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    if (!isValidName(firstName) || !isValidName(lastName)) {
      setNameError(true);
      return;
    }
    setNameError(false);

    var cleanEmail = normalizeEmail(email);
    if (!API.OTP_SEND && customerEmailTaken(cleanEmail)) {
      setTakenEmail(cleanEmail);
      return;
    }
    setEmailError('');

    if (!isValidPassword(password)) {
      setPasswordError(PASSWORD_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordError('');

    setFirstName(normalizeName(firstName));
    setLastName(normalizeName(lastName));
    setEmail(cleanEmail);
    setOtp('');
    setOtpError('');
    setOtpInfo('');
    // Ask the server first: if the email already has an account we show the
    // pop-up and stay on the form instead of waiting for a code that never comes.
    var result = await sendOtp(cleanEmail, false);
    if (result === 'taken') {
      setTakenEmail(cleanEmail);
      return;
    }
    setScreen('otp');
  }

  // Pop-up "No": close it and let the user retype a different email (or other details).
  function handleUseDifferentEmail() {
    setTakenEmail('');
    setEmail('');
    setEmailError('');
    setTimeout(function () {
      var input = document.getElementById('signupEmail');
      if (input) input.focus();
    }, 0);
  }

  // Pop-up "Yes": go to Login with that email already filled in.
  function handleGoToLogin() {
    var target = takenEmail;
    setTakenEmail('');
    navigate(loginHref, { state: { email: target, notice: 'That email already has an account. Log in below.' } });
  }

  // Back to the form with everything still filled in, so a typo'd email can be fixed.
  function handleChangeEmail() {
    setScreen('form');
    setOtp('');
    setOtpError('');
    setOtpInfo('');
    setDemoOtp(null);
    setDemoHint('');
    setCooldown(0);
  }

  async function handleVerifyOtp() {
    if (verifyingRef.current) return;
    var code = otp.trim();

    if (!/^\d{6}$/.test(code)) {
      setOtpError('Enter the full 6-digit code (numbers only).');
      return;
    }

    verifyingRef.current = true;
    setVerifying(true);
    setOtpError('');

    var fields = { firstName: normalizeName(firstName), lastName: normalizeName(lastName), email: normalizeEmail(email), password: password };

    try {
      if (!API.OTP_VERIFY) {
        if (code !== demoOtp) {
          setOtpError("That code doesn't match. Try again.");
          return;
        }
        // Creates the account only. The user is NOT signed in here.
        await registerCustomerLocal(fields);
      } else {
        // The server verifies the code and creates the account. It does not
        // start a session: the user must log in first.
        await apiRequest(API.OTP_VERIFY, {
          method: 'POST',
          body: { email: fields.email, code: code, firstName: fields.firstName, lastName: fields.lastName, password: fields.password }
        });
      }
      // Account created: send the user to the Login page (keeping ?redirect=).
      navigate(safeTarget !== '/' ? '/login?redirect=' + encodeURIComponent(safeTarget) : '/login', {
        replace: true,
        state: { notice: 'Account created! Log in to continue.', email: fields.email }
      });
      return;
    } catch (err) {
      if (err && err.status === 409) setOtpError('An account with this email already exists. Log in instead.');
      else if (err && (err.status === 400 || err.status === 401 || err.status === 422)) setOtpError("That code doesn't match. Try again.");
      else setOtpError(authErrorMessage(err, 'Could not verify the code. Check your connection and try again.'));
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }

  function handleOtpSubmit(e) {
    e.preventDefault();
    handleVerifyOtp();
  }

  function handleResend() {
    if (cooldown > 0 || sending) return;
    sendOtp(normalizeEmail(email), true);
  }

  return (
    <div className="auth-card">
      <ConfirmDialog
        open={!!takenEmail}
        title="Email already in use"
        message={'The email ' + takenEmail + ' already has an account. Do you want to log in instead?'}
        confirmLabel="Yes, log in"
        cancelLabel="No, use another email"
        confirmClass="btn-yellow"
        onConfirm={handleGoToLogin}
        onCancel={handleUseDifferentEmail}
      />
      <p className="auth-eyebrow mono">REGISTRATION</p>
      <h1>Join The Crew</h1>
      <p className="auth-sub mono">Track your builds. Book services. Access your history.</p>

      {screen === 'form' && (
        <div className="auth-panel" id="signupFormScreen">
          <form onSubmit={handleFormSubmit}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="signupFirstName">Name</label>
                <div className="field-input-wrap">
                  <input
                    id="signupFirstName"
                    aria-label="First name"
                    type="text"
                    name="first_name"
                    placeholder="FIRST NAME"
                    maxLength={NAME_MAX}
                    required
                    value={firstName}
                    onChange={handleNameChange(setFirstName)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="signupLastName">&nbsp;</label>
                <div className="field-input-wrap">
                  <input
                    id="signupLastName"
                    aria-label="Last name"
                    type="text"
                    name="last_name"
                    placeholder="LAST NAME"
                    maxLength={NAME_MAX}
                    required
                    value={lastName}
                    onChange={handleNameChange(setLastName)}
                  />
                </div>
              </div>
            </div>
            <p className={'booking-error mono' + (nameError ? ' show' : '')}>{NAME_MESSAGE}</p>

            <div className="field">
              <label htmlFor="signupEmail">Email</label>
              <div className="field-input-wrap">
                <input
                  id="signupEmail"
                  type="email"
                  name="email"
                  placeholder="ENTER EMAIL"
                  maxLength={EMAIL_MAX}
                  required
                  value={email}
                  onChange={function (e) { setEmail(e.target.value); }}
                />
              </div>
              <p className={'booking-error mono' + (emailError ? ' show' : '')}>{emailError}</p>
            </div>

            <div className="field">
              <label htmlFor="signupPassword">Password</label>
              <PasswordField
                id="signupPassword"
                name="password"
                placeholder="ENTER PASSWORD"
                minLength={8}
                maxLength={32}
                required
                value={password}
                onChange={function (e) { setPassword(e.target.value); }}
              />
              <p className="field-hint mono">8-32 characters, at least one letter and one number.</p>
            </div>

            <div className="field">
              <label htmlFor="signupConfirmPassword">Confirm Password</label>
              <PasswordField
                id="signupConfirmPassword"
                name="confirm_password"
                placeholder="CONFIRM PASSWORD"
                minLength={8}
                maxLength={32}
                required
                value={confirmPassword}
                onChange={function (e) { setConfirmPassword(e.target.value); }}
              />
              <p className={'booking-error mono' + (passwordError ? ' show' : '')}>{passwordError || PASSWORD_MESSAGE}</p>
            </div>

            <button type="submit" className="auth-submit" disabled={sending}>{sending ? 'Sending code...' : 'Send Verification Code \u2192'}</button>
          </form>

          <p className="auth-switch mono">Already have an account? <Link to={loginHref}>Login</Link></p>
        </div>
      )}

      {screen === 'otp' && (
        <div className="auth-panel" id="otpScreen">
          <p className="mono" style={{ color: 'var(--text-dim)', fontSize: '12px', marginBottom: '20px' }}>
            We sent a 6-digit code to <span style={{ color: 'var(--yellow)' }}>{email}</span>.{' '}
            <button type="button" className="link-btn" onClick={handleChangeEmail}>Wrong email? Change it</button>
          </p>

          <form onSubmit={handleOtpSubmit}>
          <div className="field">
            <label htmlFor="otpInput">Verification Code</label>
            <div className="field-input-wrap">
              <input
                id="otpInput"
                type="text"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={function (e) { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
              />
            </div>
            <p className="field-hint mono">{demoHint}</p>
          </div>

          {otpInfo && <p className="field-hint mono" role="status" style={{ color: 'var(--green)' }}>{otpInfo}</p>}
          <p className={'booking-error mono' + (otpError ? ' show' : '')} role="alert">{otpError}</p>

          <button type="submit" className="auth-submit" disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify & Create Account'}
          </button>
          </form>

          <p className="auth-switch mono">
            Didn't get it?{' '}
            <button type="button" className="link-btn" onClick={handleResend} disabled={cooldown > 0 || sending}>
              {cooldown > 0 ? 'Resend code in ' + cooldown + 's' : sending ? 'Sending...' : 'Resend code'}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SignupPage() {
  usePageTitle('Sign Up — LS Customs');

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
            <SignupForm />
          </div>
        </div>

        <AuthFooter />
      </div>
    </RedirectIfAuthenticated>
  );
}
