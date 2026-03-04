import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';

const BranchManager = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    manager: '',
    status: 'Activo'
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "branches"), (querySnapshot) => {
      const branchesData = [];
      querySnapshot.forEach((doc) => {
        branchesData.push({ id: doc.id, ...doc.data() });
      });
      setBranches(branchesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingBranch(null);
    setFormData({ name: '', location: '', manager: '', status: 'Activo' });
    setIsModalOpen(true);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location,
      manager: branch.manager,
      status: branch.status || 'Activo'
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        // Update
        await updateDoc(doc(db, "branches", editingBranch.id), {
          ...formData,
          color: formData.status === 'Activo' ? 'bg-green-500' : 'bg-slate-500'
        });
      } else {
        // Create
        await addDoc(collection(db, "branches"), {
          ...formData,
          stockLevel: 0,
          color: formData.status === 'Activo' ? 'bg-green-500' : 'bg-slate-500',
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNbT68GxPjS4Yd2BmnrLnjD5uksIDQxEFHqhLsIeoBrhvj0kUn262HCqg1NxG-LyDycMfg_xIwCIYLViYtRsJJDaHccNavYgBSAJydeoKJ5zxmBpFjQhODixqYH81CFN7mn51zNL7Y3sxY0zIs6Bvh0NcJ3GWH4CelzQuJEkxcm6rBxSPPV82L_jbtKRfO246-Gr4RByHnDO06LvKC6ZitW2nzU_zFy_y9r05kT61rztd30p3lGu3UqvQfH12gFGPB8p1B8cs5yEM'
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving branch:", error);
      alert("Error al guardar la sucursal");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar esta sucursal?')) {
      try {
        await deleteDoc(doc(db, "branches", id));
      } catch (error) {
        console.error("Error deleting branch:", error);
      }
    }
  };

  const filteredBranches = branches.filter(b => 
    b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.manager?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-1 justify-center py-8 px-6 lg:px-40 animate-fadeIn">
        <div className="flex flex-col w-full">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Sucursales</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Supervise y administre sus puntos de venta.</p>
            </div>
            <div className="flex gap-3">
              <div className="relative w-64 hidden sm:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary outline-none transition-all" 
                  placeholder="Buscar sucursal..." 
                />
              </div>
              <button 
                onClick={openAddModal}
                className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25"
              >
                <span className="material-symbols-outlined text-lg">add_location</span>
                <span>Nueva Sucursal</span>
              </button>
            </div>
          </div>

          {loading ? (
             <div className="flex justify-center py-20">
               <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredBranches.map(branch => {
                 const isClosed = branch.status !== 'Activo';
                 const stockLvl = branch.stockLevel || 0;
                 return (
                  <div key={branch.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all group">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5"></div>
                      {branch.image && <img alt={branch.name} className="w-full h-full object-cover opacity-80" src={branch.image}/>}
                      <div className={`absolute top-3 right-3 ${isClosed ? 'bg-slate-500/90' : 'bg-green-500/90'} backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded uppercase`}>
                        {branch.status || 'Activo'}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{branch.name}</h3>
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mt-1">
                            <span className="material-symbols-outlined text-sm">location_on</span>
                            <span className="truncate max-w-[200px]">{branch.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(branch)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg transition-colors bg-slate-50 dark:bg-slate-800">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete(branch.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors bg-rose-50 dark:bg-rose-900/20">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-3 mb-6 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg ${isClosed ? 'opacity-60' : ''}`}>
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined">person</span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Gerente</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{branch.manager}</p>
                        </div>
                      </div>
                      
                      <div className={`space-y-2 mt-auto ${isClosed ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">Nivel de Stock Base</span>
                          <span className="text-slate-900 dark:text-white font-bold">{stockLvl}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isClosed ? 'bg-slate-400' : (stockLvl < 20 ? 'bg-red-500' : (stockLvl < 50 ? 'bg-amber-500' : 'bg-primary'))}`} style={{ width: `${Math.min(stockLvl, 100)}%` }}></div>
                        </div>
                        <p className={`text-[11px] font-medium flex items-center gap-1 ${isClosed ? 'text-slate-500' : (stockLvl < 20 ? 'text-red-600' : (stockLvl < 50 ? 'text-amber-600' : 'text-green-600'))}`}>
                          <span className="material-symbols-outlined text-xs">
                            {isClosed ? 'schedule' : (stockLvl < 20 ? 'error' : (stockLvl < 50 ? 'warning' : 'check_circle'))}
                          </span> 
                          {isClosed ? 'Operaciones suspendidas' : 'Estado del inventario'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add New Branch Card Placeholder */}
              <button onClick={openAddModal} className="bg-slate-50 dark:bg-slate-800/20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center p-8 gap-4 hover:border-primary hover:bg-primary/5 transition-all group min-h-[340px]">
                <div className="size-16 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors">add</span>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 dark:text-white">Registrar Sucursal</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Expanda su red de negocios</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal correctly configured to take full screen with high z-index */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
              <div 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{editingBranch ? 'edit_square' : 'add_business'}</span>
                    {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre referencial</label>
                      <input 
                        required 
                        type="text" 
                        value={formData.name} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                        placeholder="Ej. Sede Central" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Dirección / Ubicación</label>
                      <input 
                        required 
                        type="text" 
                        value={formData.location} 
                        onChange={(e) => setFormData({...formData, location: e.target.value})} 
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                        placeholder="Ej. Av. Principal 123" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Gerente</label>
                      <input 
                        required 
                        type="text" 
                        value={formData.manager} 
                        onChange={(e) => setFormData({...formData, manager: e.target.value})} 
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                        placeholder="Ej. Carlos Ruiz" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado Operativo</label>
                      <select 
                        value={formData.status} 
                        onChange={(e) => setFormData({...formData, status: e.target.value})} 
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      >
                        <option value="Activo">Activo</option>
                        <option value="Cerrado">Cerrado / Suspendido</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">save</span>
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
    </AppLayout>
  );
};

export default BranchManager;
