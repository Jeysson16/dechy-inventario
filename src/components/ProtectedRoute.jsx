import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireBranch = false }) => {
  const { currentUser, currentBranch } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/acceso" state={{ from: location }} replace />;
  }

  if (requireBranch && !currentBranch) {
    return <Navigate to="/seleccionar-sucursal" state={{ from: location }} replace />;
  }

  return children;
};
