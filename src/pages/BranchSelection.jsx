import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const BranchSelection = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchData, setNewBranchData] = useState({
    name: '',
    location: '',
    manager: ''
  });
  const { currentUser, currentBranch, isAdmin, selectBranch, logout, userProfile, authLoading } = useAuth();
  const navigate = useNavigate();

  // If user already has a branch (e.g. auto-assigned from profile), go straight to panel
  useEffect(() => {
    if (currentBranch) {
      navigate('/panel', { replace: true });
    }
  }, [currentBranch, navigate]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to finish

    if (!currentUser) {
      navigate('/acceso');
      return;
    }
    
    // Fetch branches if profile exists, or stop loading if profile failed to load
    if (userProfile) {
        fetchBranches();
    } else {
        // Edge case: User logged in but profile missing/failed. Stop loading so UI isn't stuck.
        setLoading(false);
    }
  }, [currentUser, navigate, userProfile, authLoading]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      let query = supabase.from('branches').select('*');
      
      // Filter by company if user has one
      if (userProfile?.company_id) {
          query = query.eq('company_id', userProfile.company_id);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const branchesData = data.map(b => ({
          id: b.id,
          name: b.name,
          location: b.address,
          image: b.image_url,
          color: b.primary_color,
          manager: b.settings?.manager_name || 'N/A',
          status: 'Activo' // Mock status
      }));

      // Only force creation if admin has 0 branches. If not admin, they just see empty list or "Contact Admin"
      if (branchesData.length === 0 && isAdmin) {
        setIsCreating(true);
      }

      setBranches(branchesData);
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('branches').insert({
        name: newBranchData.name,
        address: newBranchData.location,
        image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNbT68GxPjS4Yd2BmnrLnjD5uksIDQxEFHqhLsIeoBrhvj0kUn262HCqg1NxG-LyDycMfg_xIwCIYLViYtRsJJDaHccNavYgBSAJydeoKJ5zxmBpFjQhODixqYH81CFN7mn51zNL7Y3sxY0zIs6Bvh0NcJ3GWH4CelzQuJEkxcm6rBxSPPV82L_jbtKRfO246-Gr4RByHnDO06LvKC6ZitW2nzU_zFy_y9r05kT61rztd30p3lGu3UqvQfH12gFGPB8p1B8cs5yEM',
        primary_color: '#10b981', // green-500
        settings: { manager_name: newBranchData.manager },
        company_id: userProfile?.company_id // Associate with company
      }).select().single();

      if (error) throw error;

      setIsCreating(false);
      setNewBranchData({ name: '', location: '', manager: '' });
      fetchBranches();
    } catch (error) {
      console.error("Error creating branch:", error);
      setLoading(false);
    }
  };

  const handleSelectBranch = (branch) => {
    selectBranch(branch);
    // navigate('/panel'); // REMOVED: Let useEffect handle navigation after state update
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-display transition-colors duration-300">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-xl h-10 w-10 flex items-center justify-center p-2 text-white shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-2xl">diamond</span>
          </div>
          <h1 className="text-slate-900 dark:text-white font-extrabold text-xl tracking-tight">DECHY</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{userProfile?.full_name || 'Usuario'}</span>
            <span className="text-xs text-slate-500 font-medium">{currentUser?.email}</span>
          </div>
          <button 
            onClick={logout} 
            className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all duration-200 flex items-center gap-2 group"
            title="Cerrar Sesión"
          >
            <span className="material-symbols-outlined group-hover:scale-110 transition-transform">logout</span>
            <span className="text-sm font-bold hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-10 flex flex-col justify-center">
        <div className="mb-12 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-6">
            <span className="material-symbols-outlined text-4xl text-primary">storefront</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Selecciona tu Sucursal
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Bienvenido de nuevo. Elige la sede a la que deseas acceder para gestionar el inventario y las ventas de hoy.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="size-16 border-4 border-slate-200 dark:border-slate-800 rounded-full"></div>
              <div className="absolute top-0 left-0 size-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-500 font-medium animate-pulse">Cargando sucursales...</p>
          </div>
        ) : isCreating ? (
          <div className="max-w-lg mx-auto w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden ring-1 ring-slate-900/5">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="material-symbols-outlined text-primary">add_business</span>
                </div>
                Nueva Sucursal
                </h3>
                <p className="text-slate-500 text-sm mt-1 ml-11">Ingresa los detalles de la nueva sede</p>
            </div>
            
            <form onSubmit={handleCreateBranch} className="p-8 flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nombre de la Sede</label>
                    <input 
                        required 
                        type="text" 
                        value={newBranchData.name} 
                        onChange={(e) => setNewBranchData({...newBranchData, name: e.target.value})} 
                        className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400" 
                        placeholder="Ej. Sede Central - Lima" 
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Dirección / Ubicación</label>
                    <input 
                        required 
                        type="text" 
                        value={newBranchData.location} 
                        onChange={(e) => setNewBranchData({...newBranchData, location: e.target.value})} 
                        className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400" 
                        placeholder="Ej. Av. Javier Prado 1234" 
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Gerente Asignado</label>
                    <input 
                        required 
                        type="text" 
                        value={newBranchData.manager} 
                        onChange={(e) => setNewBranchData({...newBranchData, manager: e.target.value})} 
                        className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400" 
                        placeholder="Ej. Juan Pérez" 
                    />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                {branches.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setIsCreating(false)} 
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                )}
                <button 
                    type="submit" 
                    className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                  Crear Sucursal
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="flex justify-center md:justify-end mb-8">
              {isAdmin && (
                <button 
                    onClick={() => setIsCreating(true)} 
                    className="px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-primary font-bold rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  Nueva Sucursal
                </button>
              )}
            </div>
            
            {branches.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">store_off</span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No hay sucursales disponibles</h3>
                    <p className="text-slate-500 max-w-md mx-auto">Parece que aún no tienes ninguna sucursal registrada en tu empresa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {branches.map(branch => (
                    <div 
                    key={branch.id} 
                    onClick={() => handleSelectBranch(branch)}
                    className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 relative"
                    >
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 z-10">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-md ${
                            branch.status === 'Activo' 
                            ? 'bg-emerald-500/90 text-white' 
                            : 'bg-slate-500/90 text-white'
                        }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            {branch.status}
                        </span>
                    </div>

                    {/* Image Area */}
                    <div className="h-48 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent z-0"></div>
                        <img 
                            alt={branch.name} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            src={branch.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=60'}
                        />
                        <div className="absolute bottom-4 left-4 right-4 z-10">
                            <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-md">{branch.name}</h3>
                            <div className="flex items-center gap-1.5 text-slate-200 text-sm font-medium drop-shadow-sm">
                                <span className="material-symbols-outlined text-sm">location_on</span>
                                <span className="truncate">{branch.location}</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-700">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gerente</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{branch.manager}</p>
                                </div>
                            </div>
                        </div>

                        <button className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 hover:bg-primary hover:text-white text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-white">
                            <span>Ingresar al Panel</span>
                            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </>
        )}
      </main>
      
      {/* Footer simple */}
      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>© {new Date().getFullYear()} Dechy Inventario. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default BranchSelection;
