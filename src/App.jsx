import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import AddProduct from './pages/AddProduct';
import BranchManager from './pages/BranchManager';
import BranchSelection from './pages/BranchSelection';
import Dashboard from './pages/Dashboard';
import InventoryList from './pages/InventoryList';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/acceso" replace />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
