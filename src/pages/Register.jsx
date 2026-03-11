import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Register = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Las contraseñas no coinciden.');
    }

    try {
      setError('');
      setLoading(true);
      await register(formData.email, formData.password, formData.fullName, formData.companyName);
      navigate('/seleccionar-sucursal');
    } catch (err) {
      setError('Error al crear la cuenta. ' + (err.message || ''));
      console.error(err);
    } finally {
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
      <div className="w-full max-w-[480px]">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-fadeIn">
          <div className="p-8 text-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Crear Cuenta</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Registro de Nueva Empresa</p>
          </div>
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="companyName">
                  Nombre de la Empresa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-xl">business</span>
                  </div>
                  <input 
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-sm" 
                    id="companyName" 
                    name="companyName" 
                    placeholder="Mi Empresa S.A.C." 
                    required 
                    type="text"
                    value={formData.companyName}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="fullName">
                  Nombre Completo (Admin)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-xl">person</span>
                  </div>
                  <input 
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-sm" 
                    id="fullName" 
                    name="fullName" 
                    placeholder="Juan Pérez" 
                    required 
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                </div>
              </div>

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
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="password">
                    Contraseña
                  </label>
                  <input 
                    className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-sm" 
                    id="password" 
                    name="password" 
                    placeholder="••••••••" 
                    required 
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="confirmPassword">
                    Confirmar
                  </label>
                  <input 
                    className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 text-sm" 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    placeholder="••••••••" 
                    required 
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div className="pt-2">
                <button 
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
                  type="submit"
                >
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  ¿Ya tienes una cuenta?{' '}
                  <Link to="/acceso" className="font-medium text-primary hover:text-primary-dark hover:underline">
                    Inicia Sesión
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
