import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.js';
import Login from './pages/Login.js';
import Signup from './pages/Signup.js';
import ForgotPassword from './pages/ForgotPassword.js';
import Book from './pages/Book.js';
import StaffLogin from './pages/StaffLogin.js';
import Dashboard from './pages/Dashboard.js';
import Account from './pages/Account.js';
import NotFound from './pages/NotFound.js';
import ScrollManager from './components/ScrollManager.js';

// Routes:
//   /            Home
//   /login       the ONE login for customers, staff and admins; the role
//                decides the destination (redirects away if already signed in)
//   /signup      customer signup (redirects away if already signed in)
//   /forgot-password  password recovery (demo flow; real recovery is BACKEND REQUIRED)
//   /book        booking wizard (customer session required)
//   /account     profile + My Bookings (customer session required)
//   /staff-login one-time demo "create first admin" setup only; otherwise -> /login
//   /dashboard   staff dashboard (staff session required; admin panel = admin role)
//   *            404
function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/book" element={<Book />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
