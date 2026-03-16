import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDynamicMeta } from '../hooks/useDynamicMeta';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser, isAdmin, currentBranch, userProfileLoaded } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Reset document title and favicon to defaults on login page
  useDynamicMeta(null);

  useEffect(() => {
    if (currentUser && userProfileLoaded) {
      navigate('/');
    }
  }, [currentUser, userProfileLoaded, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (err) {
      setError('Error al iniciar sesión. Verifique sus credenciales.');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-slate-950 font-display min-h-screen flex items-center justify-center p-4 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        <span className="material-symbols-outlined">
          {theme === 'dark' ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
      <div className="w-full max-w-[440px]">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-fadeIn">
          <div className="p-8 text-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Acceso al sistema</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Control de Inventario Empresarial</p>
          </div>
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-xl">mail</span>
                  </div>
                  <input 
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-sm" 
                    id="email" 
                    name="email" 
                    placeholder="nombre@empresa.com" 
                    required 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">
                    Contraseña
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-xl">lock</span>
                  </div>
                  <input 
                    className="block w-full pl-10 pr-12 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-sm" 
                    id="password" 
                    name="password" 
                    placeholder="••••••••" 
                    required 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <button 
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
                  type="submit"
                >
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  ¿No tienes una cuenta?{' '}
                  <a href="/register" className="font-medium text-primary hover:text-primary-dark hover:underline">
                    Regístrate aquí
                  </a>
                </p>
              </div>
            </form>
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-lg">verified_user</span>
                <span>Acceso Seguro y Encriptado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
