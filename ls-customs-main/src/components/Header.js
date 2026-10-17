import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ConfirmDialog from './ConfirmDialog.js';
import { logoutCustomer, logoutStaff, useCustomerSession, useStaffSession } from '../utils/auth.js';
import { businessInfo } from '../data/businessInfo.js';

// The anchor sections that live on the Home page, in the order they appear.
var sectionIds = ['services', 'schedule', 'about', 'contact'];

// variant: 'public' (Home, Book, 404) or 'account' (Account page). Both show
// the signed-in customer's name (from THEIR session) beside Log Out; signed-out
// visitors see Login. A signed-in staff/admin sees Dashboard + Log Out.
function Header({ variant }) {
  var location = useLocation();
  var navigate = useNavigate();
  var session = useCustomerSession();
  var staffSession = useStaffSession();
  var [confirmOpen, setConfirmOpen] = useState(false);
  var [navOpen, setNavOpen] = useState(false);
  var [activeSection, setActiveSection] = useState(null);

  // Scroll-spy: only on Home, where these sections are anchors.
  useEffect(function () {
    if (location.pathname !== '/') {
      setActiveSection(null);
      return undefined;
    }

    function handleScroll() {
      var scrollPos = window.scrollY + 130;
      var current = null;
      sectionIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.offsetTop <= scrollPos) current = id;
      });
      setActiveSection(current);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return function () {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname]);

  function isActive(id) {
    if (location.pathname !== '/') return false;
    if (id === 'home') return !activeSection;
    return activeSection === id;
  }

  function askLogout() {
    setNavOpen(false);
    setConfirmOpen(true);
  }

  // Confirmed: leave the page for /login first, then clear the session. Both
  // happen in one event, so protected pages never get a chance to bounce the
  // user to /login?redirect=... . logoutCustomer also clears that account's
  // booking draft.
  function confirmLogout() {
    setConfirmOpen(false);
    navigate('/login', { replace: true });
    if (session) logoutCustomer();
    else if (staffSession) logoutStaff();
  }

  function closeNav() {
    setNavOpen(false);
  }

  // Comes from the ACTIVE session's account only — never a shared global.
  var accountLabel = session ? (session.firstName || session.email || 'My Account') : '';

  function sectionLink(id, label) {
    return (
      <Link to={{ pathname: '/', hash: '#' + id }} className={isActive(id) ? 'active' : ''} onClick={closeNav}>{label}</Link>
    );
  }

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand" onClick={closeNav}>
          <div className="brand-mark"><span></span></div>
          <div className="brand-name">LS <span className="yellow">CUSTOMS</span></div>
          <div className="brand-est mono">EST. {businessInfo.established}</div>
        </Link>

        <nav className={'nav-links mono' + (navOpen ? ' nav-open' : '')}>
          <Link to="/" className={isActive('home') ? 'active' : ''} onClick={closeNav}>Home</Link>
          {sectionLink('services', 'Services')}
          {sectionLink('schedule', 'Schedule')}
          {sectionLink('about', 'About')}
          {sectionLink('contact', 'Contact')}
        </nav>

        <div className="nav-right">
          {session ? (
            <>
              <Link to="/account" className={'login-link mono' + (variant === 'account' ? ' current' : '')} aria-current={variant === 'account' ? 'page' : undefined}>{accountLabel}</Link>
              <button type="button" className="login-link mono" onClick={askLogout}>Log Out</button>
            </>
          ) : staffSession ? (
            <>
              <Link to="/dashboard" className="login-link mono">Dashboard</Link>
              <button type="button" className="login-link mono" onClick={askLogout}>Log Out</button>
            </>
          ) : (
            <Link to="/login" className="login-link mono">Login</Link>
          )}
          <Link to="/book" className="btn btn-yellow">+ Book Appointment</Link>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle menu"
            aria-expanded={navOpen}
            onClick={function () { setNavOpen(!navOpen); }}
          >
            &#9776;
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        onConfirm={confirmLogout}
        onCancel={function () { setConfirmOpen(false); }}
      />
    </header>
  );
}

export default Header;
