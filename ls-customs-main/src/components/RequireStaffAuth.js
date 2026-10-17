import { Navigate } from 'react-router-dom';
import { API } from '../config/api.js';
import { hasLocalStaffAccounts, useStaffSession } from '../utils/auth.js';

// Client-side gate for /dashboard. The role always comes from the staff
// session; the server must still verify token + role on every request.
// Signed-out visitors go to the shared /login. (Only when the demo has no staff
// accounts at all do they go to the one-time /staff-login setup screen.)
function RequireStaffAuth({ children }) {
  var session = useStaffSession();
  if (!session) {
    var needsSetup = !API.LOGIN && !hasLocalStaffAccounts();
    return <Navigate to={needsSetup ? '/staff-login' : '/login'} replace />;
  }
  return children;
}

export default RequireStaffAuth;
