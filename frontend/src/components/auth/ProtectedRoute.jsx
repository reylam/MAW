import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/*
  Gate for the authenticated area. Reads the real session flag from the auth
  store - it does not merely hide UI. Unauthenticated operators are redirected
  to the login route at `/`, preserving the attempted path so we could return
  there after sign-in if desired.
*/
export default function ProtectedRoute({ children }) {
  const authenticated = useAuthStore((s) => s.authenticated);
  const location = useLocation();

  if (!authenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
}
