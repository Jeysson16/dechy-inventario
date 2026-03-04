import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireBranch = false }) => {
  const { currentUser, currentBranch, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/acceso" state={{ from: location }} replace />;
  }

  if (requireBranch && !currentBranch) {
    return <Navigate to="/seleccionar-sucursal" state={{ from: location }} replace />;
  }

  return children;
};
