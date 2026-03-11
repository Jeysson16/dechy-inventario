import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const BranchSelection = () => {
  const { currentUser, logout, isAdmin, selectBranch, userProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBranchData, setNewBranchData] = useState({ name: '', location: '', manager: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/acceso');
      return;
    }
    fetchBranches();
  }, [currentUser, userProfile, navigate]); // Added currentUser and navigate to dependencies

  const fetchBranches = async () => {
    try {
      setLoading(true);
      let q;
      
      if (isAdmin) {
        // Admin: see all branches
        q = collection(db, "branches");
      } else if (userProfile?.companyId) {
        // Non-admin: only see branches of their company
        q = query(collection(db, "branches"), where("companyId", "==", userProfile.companyId));
      } else {
        setBranches([]);
        setLoading(false);
        return;
      }

      const querySnapshot = await getDocs(q);
      const branchesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBranches(branchesList);
      
      // If none, and admin, show creation form
      if (branchesList.length === 0 && isAdmin) {
        setIsCreating(true);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const newBranch = {
        ...newBranchData,
        companyId: userProfile?.companyId || 'default',
        status: 'Activo',
        color: 'bg-green-500',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=60'
      };
      await addDoc(collection(db, "branches"), newBranch);
      setIsCreating(false);
      setNewBranchData({ name: '', location: '', manager: '' });
      fetchBranches();
    } catch (error) {
      console.error("Error creating branch:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBranch = (branch) => {
    selectBranch(branch);
    navigate('/panel');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-slate-950 text-slate-900 font-display">
      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-lg h-10 w-10 flex items-center justify-center p-2 text-white shadow-sm shadow-primary/20">
            <span className="material-symbols-outlined">diamond</span>
          </div>
          <h1 className="text-slate-900 dark:text-white font-bold text-lg leading-tight uppercase tracking-widest">DECHY</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">{currentUser?.email}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">{userProfile?.role || 'Admin'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button onClick={logout} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg flex items-center gap-2 transition-all">
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8 px-4 md:px-8">
        <div className="mb-12 text-center max-w-2xl mx-auto mt-6">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-4">Selección de Sucursal</h2>
          <p className="text-slate-500 dark:text-slate-400">Selecciona la sede o punto de venta para comenzar la gestión de inventario y ventas en tiempo real.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center gap-4">
                <span className="material-symbols-outlined animate-spin text-5xl text-primary">progress_activity</span>
                <p className="text-slate-500 font-bold text-sm animate-pulse">Cargando sucursales...</p>
            </div>
          </div>
        ) : isCreating ? (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transform animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">add_business</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nueva Sucursal</h3>
            </div>
            <form onSubmit={handleCreateBranch} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nombre de la Sede</label>
                <input required type="text" value={newBranchData.name} onChange={(e) => setNewBranchData({...newBranchData, name: e.target.value})} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder:text-slate-400" placeholder="Ej. Almacén Central" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Dirección Física</label>
                <input required type="text" value={newBranchData.location} onChange={(e) => setNewBranchData({...newBranchData, location: e.target.value})} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder:text-slate-400" placeholder="Ej. Av. Industrial 455" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Responsable / Gerente</label>
                <input required type="text" value={newBranchData.manager} onChange={(e) => setNewBranchData({...newBranchData, manager: e.target.value})} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder:text-slate-400" placeholder="Ej. Roberto Sánchez" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                {branches.length > 0 && (
                  <button type="button" onClick={() => setIsCreating(false)} className="px-5 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Cancelar</button>
                )}
                <button type="submit" className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/25 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">save</span>
                  Guardar Sede
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-8">
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
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 animate-fadeIn">
                    <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <span className="material-symbols-outlined text-5xl">store_off</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">No hay sucursales aún</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">Comienza registrando la primera sede de tu empresa para gestionar el stock.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeIn">
                {branches.map(branch => (
                    <div 
                    key={branch.id} 
                    onClick={() => handleSelectBranch(branch)}
                    className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 relative"
                    >
                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 z-10">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md ${
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
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent z-10"></div>
                        <img 
                            alt={branch.name} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            src={branch.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=60'}
                        />
                        <div className="absolute bottom-4 left-4 right-4 z-20">
                            <h3 className="text-2xl font-black text-white mb-1 drop-shadow-lg tracking-tight leading-none">{branch.name}</h3>
                            <div className="flex items-center gap-1.5 text-slate-100 text-xs font-bold drop-shadow-md">
                                <span className="material-symbols-outlined text-sm">location_on</span>
                                <span className="truncate opacity-90">{branch.location}</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-800">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Responsable</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{branch.manager}</p>
                                </div>
                            </div>
                        </div>

                        <button className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 group-hover:bg-primary text-slate-700 dark:text-slate-300 group-hover:text-white font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-primary/20 text-xs uppercase tracking-widest">
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
      <footer className="py-8 text-center text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest">
        <p>© {new Date().getFullYear()} Dechy Inventario. Control de Gestión Profesional.</p>
      </footer>
    </div>
  );
};

export default BranchSelection;
