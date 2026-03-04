import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AppLayout = ({ children }) => {
  const { currentUser, currentBranch, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light font-display overflow-x-hidden pt-16 mt-0">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 flex items-center justify-between whitespace-nowrap border-b border-slate-200 bg-white px-4 md:px-6 lg:px-10 py-3 z-50 shadow-sm">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-600 hover:text-primary transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>

          {/* Logo */}
          <Link to="/panel" className="flex items-center gap-2 md:gap-3 text-primary hover:opacity-80 transition-opacity">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">inventory_2</span>
            </div>
            <h2 className="text-slate-900 text-lg md:text-xl font-bold leading-tight tracking-tight">DECHY</h2>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/panel"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive('/panel') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              Inicio
            </Link>
            <Link
              to="/sucursales"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive('/sucursales') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              Sucursales
            </Link>
            <Link
              to="/inventario"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive('/inventario') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              Inventario
            </Link>
            <Link
              to="/reportes"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive('/reportes') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              Reportes
            </Link>
          </nav>
        </div>

        <div className="flex justify-end gap-2 md:gap-4 items-center">
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[130px]">
                {currentUser?.email?.split('@')[0] || 'Usuario'}
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[130px]">
                {currentBranch?.name || 'Sin sucursal'}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="bg-primary/10 rounded-full size-10 flex items-center justify-center text-primary border-2 border-primary/20 hover:bg-primary hover:text-white transition-all"
              title="Cerrar sesión"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-md z-40 animate-fadeIn">
          <nav className="flex flex-col p-4 gap-2">
            <Link
              to="/panel"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 ${isActive('/panel') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              <span className="material-symbols-outlined text-[20px]">dashboard</span> Inicio
            </Link>
            <Link
              to="/sucursales"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 ${isActive('/sucursales') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              <span className="material-symbols-outlined text-[20px]">store</span> Sucursales
            </Link>
            <Link
              to="/inventario"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 ${isActive('/inventario') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              <span className="material-symbols-outlined text-[20px]">inventory_2</span> Inventario
            </Link>
            <Link
              to="/reportes"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 ${isActive('/reportes') ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-primary/5'}`}
            >
              <span className="material-symbols-outlined text-[20px]">insert_chart</span> Reportes
            </Link>
            
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-1 sm:hidden">
                <p className="text-sm font-bold text-slate-900 px-4">
                  {currentUser?.email?.split('@')[0] || 'Usuario'}
                </p>
                <p className="text-xs text-slate-500 px-4">
                  {currentBranch?.name || 'Sin sucursal'}
                </p>
            </div>
          </nav>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="px-6 lg:px-10 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-2">
        <p className="text-slate-500 text-sm">© {new Date().getFullYear()} DECHY. Todos los derechos reservados.</p>
        <div className="flex items-center gap-6">
          <a className="text-slate-400 hover:text-primary transition-colors text-sm" href="#">Privacidad</a>
          <a className="text-slate-400 hover:text-primary transition-colors text-sm" href="#">Términos</a>
          <a className="text-slate-400 hover:text-primary transition-colors text-sm" href="#">Soporte</a>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
