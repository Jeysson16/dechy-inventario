import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AddProduct from './pages/AddProduct';
import BranchManager from './pages/BranchManager';
import BranchSelection from './pages/BranchSelection';
import Dashboard from './pages/Dashboard';
import InventoryList from './pages/InventoryList';
import Login from './pages/Login';
import Reports from './pages/Reports';
import { ProtectedRoute } from './router/ProtectedRoute';

const IndexRedirect = () => {
  const { currentUser, currentBranch, authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/acceso" replace />;
  if (!currentBranch) return <Navigate to="/seleccionar-sucursal" replace />;
  return <Navigate to="/panel" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/" element={<IndexRedirect />} />
          <Route path="/acceso" element={<Login />} />
          <Route
            path="/seleccionar-sucursal"
            element={
              <ProtectedRoute>
                <BranchSelection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/panel"
            element={
              <ProtectedRoute requireBranch>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sucursales"
            element={
              <ProtectedRoute requireBranch>
                <BranchManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventario"
            element={
              <ProtectedRoute requireBranch>
                <InventoryList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nuevo-producto"
            element={
              <ProtectedRoute requireBranch>
                <AddProduct />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <ProtectedRoute requireBranch>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-All Route */}
          <Route path="*" element={<IndexRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
