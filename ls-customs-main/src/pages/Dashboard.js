import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.js';
import RequireStaffAuth from '../components/RequireStaffAuth.js';
import { API } from '../config/api.js';
import { authErrorMessage, logoutStaff, useStaffSession } from '../utils/auth.js';
import { listBookings, subscribeBookings, updateBookingStatus } from '../utils/bookingsStore.js';
import { STATUS_LABELS, allowedNextStatuses, canTransition } from '../utils/bookingStatus.js';
import { addStaff, listStaff, removeStaff } from '../utils/staffStore.js';
import { EMAIL_MAX, NAME_MAX, NAME_MESSAGE, PASSWORD_MESSAGE, isValidName, isValidPassword, normalizeEmail, normalizeName } from '../utils/validation.js';
import { businessInfo, currentYear } from '../data/businessInfo.js';
import { usePageTitle } from '../utils/usePageTitle.js';
import { useLiveRefresh } from '../utils/useLiveRefresh.js';

// How often the staff table re-checks the database for new bookings.
var REFRESH_MS = 8000;

function errorText(err, fallback) {
  if (err && err.status === 0) return 'Could not reach the server. Check your connection and try again.';
  if (err && err.status === 409) return 'That change is no longer allowed. The booking may have been updated already.';
  if (err && err.status === 403) return "You don't have permission to do that.";
  return fallback;
}

function BookingsTable({ session }) {
  var [state, setState] = useState({ status: 'loading', bookings: [] });
  var [busyIds, setBusyIds] = useState({});
  var [actionError, setActionError] = useState('');
  var busyRef = useRef({});
  var bookingsRef = useRef([]);

  var load = useCallback(function (silent) {
    if (!silent) setState({ status: 'loading', bookings: [] });
    return listBookings({ token: session.token }).then(function (bookings) {
      bookingsRef.current = bookings;
      setState({ status: 'ready', bookings: bookings });
    }).catch(function (err) {
      // Expired or revoked login: sign out so the guard sends staff back to /login.
      if (err && err.status === 401) { logoutStaff(); return; }
      // A failed background refresh keeps the last good data on screen.
      if (!silent) setState({ status: 'error', bookings: [] });
    });
  }, [session.token]);

  useEffect(function () {
    load(false);
    // Bookings made (or cancelled) in another tab/page show up without a reload.
    return subscribeBookings(function () { load(true); });
  }, [load]);

  // New bookings from customers appear on their own (no manual refresh needed).
  useLiveRefresh(!!API.BOOKINGS, useCallback(function () { load(true); }, [load]), REFRESH_MS);

  // The request happens here, NOT inside a setState updater, so StrictMode's
  // double-invoked updaters can never send it twice.
  async function handleStatusChange(booking, nextStatus) {
    if (busyRef.current[booking.id]) return;
    if (!canTransition(booking.status, nextStatus)) {
      setActionError('That status change is not allowed.');
      return;
    }
    if (nextStatus === 'cancelled' && !window.confirm('Cancel booking ' + booking.referenceCode + '?')) return;

    busyRef.current[booking.id] = true;
    setBusyIds(function (prev) {
      var next = Object.assign({}, prev);
      next[booking.id] = true;
      return next;
    });
    setActionError('');

    try {
      var updated = await updateBookingStatus(booking.id, nextStatus, { token: session.token });
      setState(function (prev) {
        return {
          status: prev.status,
          bookings: prev.bookings.map(function (b) { return b.id === booking.id ? Object.assign({}, b, updated) : b; })
        };
      });
    } catch (err) {
      setActionError(errorText(err, "Couldn't save that status change. Try again."));
      load(true);
    } finally {
      delete busyRef.current[booking.id];
      setBusyIds(function (prev) {
        var next = Object.assign({}, prev);
        delete next[booking.id];
        return next;
      });
    }
  }

  return (
    <>
      <h1 className="dashboard-title">Bookings</h1>
      <p className="dashboard-sub mono">Everything currently scheduled. New bookings appear here automatically. Update a status as work happens.</p>

      {actionError && <p className="booking-error mono show" role="alert">{actionError}</p>}

      {state.status === 'loading' && <p className="dashboard-sub mono">Loading bookings...</p>}

      {state.status === 'error' && (
        <div>
          <p className="booking-error mono show" role="alert">Could not load bookings.</p>
          <button type="button" className="btn btn-outline" onClick={function () { load(false); }}>Try again</button>
        </div>
      )}

      {state.status === 'ready' && state.bookings.length === 0 && (
        <p className="dashboard-sub mono">No bookings yet.</p>
      )}

      {state.status === 'ready' && state.bookings.length > 0 && (
        <div className="booking-table-wrap">
          <table className="booking-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Service(s)</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.bookings.map(function (booking) {
                var options = [booking.status].concat(allowedNextStatuses(booking.status));
                return (
                  <tr key={booking.id}>
                    <td>
                      <div className="cust-name">{booking.customerName || booking.customerEmail}</div>
                      <div className="cust-contact mono">{booking.customerEmail}</div>
                      <div className="cust-contact mono">{booking.referenceCode}</div>
                    </td>
                    <td>{booking.vehicle}</td>
                    <td>{(booking.services || []).join(', ')}</td>
                    <td className="mono">{booking.date}</td>
                    <td className="mono">{booking.timeSlot}</td>
                    <td>
                      <select
                        className={'status-select st-' + booking.status}
                        aria-label={'Status for booking ' + booking.referenceCode}
                        value={booking.status}
                        disabled={!!busyIds[booking.id] || options.length === 1}
                        onChange={function (e) { handleStatusChange(booking, e.target.value); }}
                      >
                        {options.map(function (key) {
                          return <option value={key} key={key}>{STATUS_LABELS[key]}</option>;
                        })}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StaffPanel({ session }) {
  var [state, setState] = useState({ status: 'loading', staff: [] });
  var [busy, setBusy] = useState(false);
  var busyRef = useRef(false);
  var [message, setMessage] = useState('');
  var [newName, setNewName] = useState('');
  var [newEmail, setNewEmail] = useState('');
  var [newPassword, setNewPassword] = useState('');
  var [newRole, setNewRole] = useState('staff');

  var load = useCallback(function () {
    return listStaff({ token: session.token }).then(function (staff) {
      setState({ status: 'ready', staff: staff });
    }).catch(function (err) {
      if (err && err.status === 401) { logoutStaff(); return; }
      setState({ status: 'error', staff: [] });
    });
  }, [session.token]);

  useEffect(function () { load(); }, [load]);

  var adminCount = state.staff.filter(function (a) { return a.role === 'admin'; }).length;

  function removalBlockedReason(account) {
    if (account.id === session.id || normalizeEmail(account.email) === normalizeEmail(session.email)) {
      return "You can't remove your own account.";
    }
    if (account.role === 'admin' && adminCount <= 1) return "You can't remove the last admin.";
    return '';
  }

  async function handleRemove(account) {
    if (busyRef.current) return;
    if (removalBlockedReason(account)) return;
    if (!window.confirm('Remove ' + account.name + ' (' + account.email + ')? They will lose access.')) return;

    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      // Uses the account's real ID, not its position in the list.
      await removeStaff(account.id, { token: session.token, currentId: session.id });
      await load();
    } catch (err) {
      setMessage(authErrorMessage(err, errorText(err, "Couldn't remove that account. Try again.")));
      load();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (busyRef.current) return;

    var name = normalizeName(newName);
    var email = normalizeEmail(newEmail);

    if (!isValidName(name)) {
      setMessage(NAME_MESSAGE);
      return;
    }
    if (!email) {
      setMessage('Enter an email address.');
      return;
    }
    if (state.staff.some(function (a) { return normalizeEmail(a.email) === email; })) {
      setMessage('A staff account with that email already exists.');
      return;
    }
    if (!API.STAFF_ACCOUNTS && !isValidPassword(newPassword)) {
      setMessage(PASSWORD_MESSAGE);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await addStaff({ name: name, email: email, role: newRole, password: newPassword }, { token: session.token });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('staff');
      await load();
    } catch (err) {
      setMessage(err && err.status === 409
        ? 'A staff account with that email already exists.'
        : authErrorMessage(err, errorText(err, "Couldn't add that account. Try again.")));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-title">
        <span>Manage Staff Accounts</span>
        <span className="admin-only-tag mono">Admin Only</span>
      </div>

      {state.status === 'loading' && <p className="dashboard-sub mono" style={{ padding: '16px 20px', margin: 0 }}>Loading staff...</p>}
      {state.status === 'error' && (
        <div style={{ padding: '16px 20px' }}>
          <p className="booking-error mono show" role="alert">Could not load staff accounts.</p>
          <button type="button" className="btn btn-outline" onClick={load}>Try again</button>
        </div>
      )}

      {state.status === 'ready' && (
        <div>
          {state.staff.map(function (account) {
            var blocked = removalBlockedReason(account);
            return (
              <div className="staff-row" key={account.id}>
                <div>
                  <div className="staff-row-name">{account.name}</div>
                  <div className="staff-row-role mono">{account.role} &middot; {account.email}</div>
                </div>
                <button
                  type="button"
                  className="remove-staff-btn"
                  disabled={busy || !!blocked}
                  title={blocked || undefined}
                  onClick={function () { handleRemove(account); }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {message && <p className="booking-error mono show" role="alert" style={{ margin: '12px 20px 0' }}>{message}</p>}

      <form className="add-staff-form" onSubmit={handleAdd}>
        <input type="text" placeholder="STAFF NAME" required maxLength={NAME_MAX} aria-label="Staff name" value={newName} onChange={function (e) { setNewName(e.target.value); }} />
        <input type="email" placeholder="EMAIL" required maxLength={EMAIL_MAX} aria-label="Staff email" value={newEmail} onChange={function (e) { setNewEmail(e.target.value); }} />
        {!API.STAFF_ACCOUNTS && (
          <input type="password" placeholder="TEMP PASSWORD" required maxLength={32} aria-label="Temporary password" value={newPassword} onChange={function (e) { setNewPassword(e.target.value); }} />
        )}
        <select aria-label="Role" value={newRole} onChange={function (e) { setNewRole(e.target.value); }}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="btn btn-yellow" style={{ padding: '10px 20px' }} disabled={busy}>Add</button>
      </form>
    </section>
  );
}

function DashboardContent() {
  var session = useStaffSession();
  var navigate = useNavigate();
  var [confirmOpen, setConfirmOpen] = useState(false);
  usePageTitle('Dashboard — LS Customs');

  if (!session) return null;

  // Confirmed: go to the shared /login first, then clear the staff session.
  function confirmLogout() {
    setConfirmOpen(false);
    navigate('/login', { replace: true });
    logoutStaff();
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-topbar">
        <div className="container">
          <div className="brand">
            <div className="brand-mark"><span></span></div>
            <div className="brand-name">LS <span className="yellow">CUSTOMS</span></div>
          </div>

          <div className="role-switch mono">
            {session.mode === 'local' && <span className="demo-flag">Demo mode &mdash; no backend yet</span>}
            <span>{session.name || session.email} &middot; {session.role}</span>
            <button type="button" className="login-link" onClick={function () { setConfirmOpen(true); }}>Log out</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="container">
          <BookingsTable session={session} />
          {session.role === 'admin' && <StaffPanel key={session.id || session.email} session={session} />}
        </div>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        onConfirm={confirmLogout}
        onCancel={function () { setConfirmOpen(false); }}
      />

      <footer className="site-footer">
        <p>&copy; {currentYear()} {businessInfo.name}. {businessInfo.cityLabel}. Est. {businessInfo.established}.</p>
      </footer>
    </div>
  );
}

function Dashboard() {
  return (
    <RequireStaffAuth>
      <DashboardContent />
    </RequireStaffAuth>
  );
}

export default Dashboard;
