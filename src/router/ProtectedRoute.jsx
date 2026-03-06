import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireBranch = false, requireRole = null }) => {
  const { currentUser, currentBranch, authLoading, userProfileLoaded, isAdmin, userRole } = useAuth();
  const location = useLocation();

  // Check role access
  const hasRoleAccess = !requireRole || requireRole.includes(userRole);

  useEffect(() => {
    if (!authLoading && currentUser && requireRole && !hasRoleAccess) {
      toast.error('No tienes permiso para acceder a esta sección.');
    }
  }, [authLoading, currentUser, hasRoleAccess, requireRole]);

  // Show spinner while auth or Firestore profile is still loading
  if (authLoading || (currentUser && !userProfileLoaded)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/acceso" state={{ from: location }} replace />;
  }

  if (!hasRoleAccess) {
    return <Navigate to="/panel" replace />;
  }

  // Only admins need to pick a branch manually. Non-admins get it from their profile.
  if (requireBranch && !currentBranch && isAdmin) {
    return <Navigate to="/seleccionar-sucursal" state={{ from: location }} replace />;
  }

  return children;
};
