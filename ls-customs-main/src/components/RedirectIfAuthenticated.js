import { Navigate, useSearchParams } from 'react-router-dom';
import { useCustomerSession, useStaffSession } from '../utils/auth.js';
import { safeRedirect } from '../utils/redirect.js';

// Wraps Login / Signup / Forgot Password: anyone already signed in is sent
// onward instead of seeing the form. The ROLE decides where:
//   staff / admin -> /dashboard   (a ?redirect= param is ignored for them)
//   customer      -> the validated ?redirect= target, else Home
function RedirectIfAuthenticated({ children }) {
  var customer = useCustomerSession();
  var staff = useStaffSession();
  var [params] = useSearchParams();

  if (staff) return <Navigate to="/dashboard" replace />;
  if (customer) return <Navigate to={safeRedirect(params.get('redirect'))} replace />;
  return children;
}

export default RedirectIfAuthenticated;
