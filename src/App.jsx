import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import AddProduct from './pages/AddProduct';
import BranchManager from './pages/BranchManager';
import BranchSelection from './pages/BranchSelection';
import Dashboard from './pages/Dashboard';
import InventoryList from './pages/InventoryList';
import Login from './pages/Login';

const IndexRedirect = () => {
  const { currentUser, currentBranch } = useAuth();
  if (!currentUser) return <Navigate to="/acceso" replace />;
  if (!currentBranch) return <Navigate to="/seleccionar-sucursal" replace />;
  return <Navigate to="/panel" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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

          {/* Fallback Catch-All Route */}
          <Route path="*" element={<IndexRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
