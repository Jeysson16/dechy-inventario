import { Toaster } from "react-hot-toast";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AddProduct from "./pages/AddProduct";
import BranchLayoutConfig from "./pages/BranchLayoutConfig";
import BranchManager from "./pages/BranchManager";
import BranchSelection from "./pages/BranchSelection";
import Dashboard from "./pages/Dashboard";
import EmployeeManager from "./pages/EmployeeManager";
import InventoryList from "./pages/InventoryList";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Sales from "./pages/Sales";
import Cashier from "./pages/Cashier";
import Delivery from "./pages/Delivery";
import StockEntry from "./pages/StockEntry";
import Categories from "./pages/Categories";
import { ProtectedRoute } from "./router/ProtectedRoute";

const IndexRedirect = () => {
  const {
    currentUser,
    currentBranch,
    authLoading,
    userProfileLoaded,
    isAdmin,
  } = useAuth();

  // Show spinner while auth or Firestore profile is still loading
  if (authLoading || (currentUser && !userProfileLoaded)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/acceso" replace />;
  // Only send to branch selection if the user is admin AND no branch picked yet
  if (isAdmin && !currentBranch)
    return <Navigate to="/seleccionar-sucursal" replace />;
  return <Navigate to="/panel" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
          <Routes>
            <Route path="/" element={<IndexRedirect />} />
            <Route path="/acceso" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
                <ProtectedRoute
                  requireBranch
                  requireRole={["admin", "manager"]}
                >
                  <BranchManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sucursales/:id/croquis"
              element={
                <ProtectedRoute
                  requireBranch
                  requireRole={["admin", "manager"]}
                >
                  <BranchLayoutConfig />
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
                <ProtectedRoute
                  requireBranch
                  requireRole={["admin", "manager"]}
                >
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/editar-producto/:id"
              element={
                <ProtectedRoute
                  requireBranch
                  requireRole={["admin", "manager"]}
                >
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ventas"
              element={
                <ProtectedRoute requireBranch>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/categorias"
              element={
                <ProtectedRoute requireBranch>
                  <Categories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caja"
              element={
                <ProtectedRoute
                  requireBranch
                  requireRole={["admin", "manager"]}
                >
                  <Cashier />
                </ProtectedRoute>
              }
            />
            <Route
              path="/despacho"
              element={
                <ProtectedRoute requireBranch>
                  <Delivery />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ingresos"
              element={
                <ProtectedRoute requireBranch>
                  <StockEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/empleados"
              element={
                <ProtectedRoute requireBranch requireRole={["admin"]}>
                  <EmployeeManager />
                </ProtectedRoute>
              }
            />

            {/* Fallback Catch-All Route */}
            <Route path="*" element={<IndexRedirect />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
