import { addDoc, collection, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
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
  const { currentUser, currentBranch, isAdmin, selectBranch, logout } = useAuth();
  const navigate = useNavigate();

  // If user already has a branch (e.g. auto-assigned from profile), go straight to panel
  useEffect(() => {
    if (currentBranch) {
      navigate('/panel', { replace: true });
    }
  }, [currentBranch, navigate]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/acceso');
      return;
    }
    fetchBranches();
  }, [currentUser, navigate]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "branches"));
      const branchesData = [];
      querySnapshot.forEach((doc) => {
        branchesData.push({ id: doc.id, ...doc.data() });
      });

      if (branchesData.length === 0) {
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
      const newBranch = {
        ...newBranchData,
        status: 'Activo',
        stockLevel: 0,
        color: 'bg-green-500',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNbT68GxPjS4Yd2BmnrLnjD5uksIDQxEFHqhLsIeoBrhvj0kUn262HCqg1NxG-LyDycMfg_xIwCIYLViYtRsJJDaHccNavYgBSAJydeoKJ5zxmBpFjQhODixqYH81CFN7mn51zNL7Y3sxY0zIs6Bvh0NcJ3GWH4CelzQuJEkxcm6rBxSPPV82L_jbtKRfO246-Gr4RByHnDO06LvKC6ZitW2nzU_zFy_y9r05kT61rztd30p3lGu3UqvQfH12gFGPB8p1B8cs5yEM'
      };
      await addDoc(collection(db, "branches"), newBranch);
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
    navigate('/panel');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light text-slate-900 font-display">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-lg h-10 w-10 flex items-center justify-center p-2 text-white shadow-sm shadow-primary/20">
            <span className="material-symbols-outlined">diamond</span>
          </div>
          <h1 className="text-slate-900 dark:text-white font-bold text-lg leading-tight">DECHY</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{currentUser?.email}</span>
          <button onClick={logout} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-8 px-4 md:px-8">
        <div className="mb-8 text-center max-w-2xl mx-auto mt-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Selección de Sucursal</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Por favor, seleccione la sucursal a la que desea ingresar para gestionar el inventario.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">data_usage</span>
          </div>
        ) : isCreating ? (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-8">
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">add_business</span>
              Crear Nueva Sucursal
            </h3>
            <form onSubmit={handleCreateBranch} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre</label>
                <input required type="text" value={newBranchData.name} onChange={(e) => setNewBranchData({...newBranchData, name: e.target.value})} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-primary focus:border-primary outline-none" placeholder="Ej. Sede Central" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ubicación</label>
                <input required type="text" value={newBranchData.location} onChange={(e) => setNewBranchData({...newBranchData, location: e.target.value})} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-primary focus:border-primary outline-none" placeholder="Ej. Av. Principal 123" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gerente</label>
                <input required type="text" value={newBranchData.manager} onChange={(e) => setNewBranchData({...newBranchData, manager: e.target.value})} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-primary focus:border-primary outline-none" placeholder="Ej. Juan Pérez" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                {branches.length > 0 && (
                  <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                )}
                <button type="submit" className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-light transition-colors shadow-md shadow-primary/20 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">save</span>
                  Crear
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-6">
              {isAdmin && (
                <button onClick={() => setIsCreating(true)} className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Nueva Sucursal
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {branches.map(branch => (
                <div 
                  key={branch.id} 
                  onClick={() => handleSelectBranch(branch)}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-primary/50 cursor-pointer transition-all transform hover:-translate-y-1"
                >
                  <div className="h-40 bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5"></div>
                    <img alt={branch.name} className="w-full h-full object-cover opacity-80" src={branch.image}/>
                    <div className={`absolute top-3 right-3 ${branch.color === 'bg-red-500' ? 'bg-red-500/90' : 'bg-green-500/90'} backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded uppercase`}>
                      {branch.status}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{branch.name}</h3>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mb-4">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      <span>{branch.location}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                      <div className="flex items-center gap-2">
                         <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{branch.manager}</span>
                      </div>
                      <button className="text-primary font-bold text-sm flex items-center gap-1">
                        Ingresar
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default BranchSelection;
