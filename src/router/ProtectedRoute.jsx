import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireBranch = false, requireRole = null }) => {
  // authLoading already covers profile loading in AuthContext
  const { currentUser, currentBranch, authLoading, isAdmin, userRole } = useAuth();
  const location = useLocation();

  // Check role access (if role is array, check inclusion; if string, check equality)
  const hasRoleAccess = !requireRole || (Array.isArray(requireRole) ? requireRole.includes(userRole) : requireRole === userRole);

  useEffect(() => {
    // Only show toast if loading is done and user is logged in but lacks permission
    if (!authLoading && currentUser && requireRole && !hasRoleAccess) {
      // toast.error('No tienes permiso para acceder a esta sección.'); // Optional: Can be annoying on redirect
    }
  }, [authLoading, currentUser, hasRoleAccess, requireRole]);

  // Show spinner while auth is loading
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

  if (!hasRoleAccess) {
    // If checking role, redirect to dashboard or appropriate page
    return <Navigate to="/panel" replace />;
  }

  // Only admins need to pick a branch manually. Non-admins get it from their profile.
  if (requireBranch && !currentBranch) {
    // If Admin, they always need to select, unless they have one auto-assigned (handled in context)
    // But if context failed or they want to switch, they go to selection.
    
    // Fix: If user is admin AND has a branch_id in profile, context should have set it.
    // If not set yet, redirect.
    
    if (isAdmin || userRole === 'manager') {
         // If admin or manager has a fixed branch in profile, they might not need to select.
         // But usually they want to see all.
         return <Navigate to="/seleccionar-sucursal" state={{ from: location }} replace />;
    } else {
         // If non-admin has no branch, something is wrong with their profile setup.
         // Redirect to a "contact admin" page or just show an error message component.
         // For now, let's keep them at selection or login to avoid loop.
         // Ideally, fetchProfile in AuthContext should have handled this.
         return (
             <div className="flex h-screen w-full flex-col items-center justify-center bg-background-light p-4 text-center">
                <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">warning</span>
                <h2 className="text-xl font-bold text-slate-800">Sin Sucursal Asignada</h2>
                <p className="text-slate-500 max-w-md mt-2">Tu usuario no tiene una sucursal asignada. Por favor, contacta al administrador del sistema.</p>
                <button onClick={() => window.location.href='/acceso'} className="mt-6 text-primary font-bold hover:underline">Volver al inicio</button>
             </div>
         );
    }
  }

  return children;
};
