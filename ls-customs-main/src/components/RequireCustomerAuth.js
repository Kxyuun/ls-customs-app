// Route guard: only a signed-in customer may see the wrapped page, otherwise redirect to /login.
import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerSession } from '../utils/auth.js';
import { loginUrlFor } from '../utils/redirect.js';

// Client-side gate only (demo). Real protection must also happen server-side
// on every API request. The redirect back is validated by safeRedirect().
function RequireCustomerAuth({ children }) {
  var session = useCustomerSession();
  var location = useLocation();

  if (!session) {
    return <Navigate to={loginUrlFor(location.pathname + location.search)} replace />;
  }
  return children;
}

export default RequireCustomerAuth;
