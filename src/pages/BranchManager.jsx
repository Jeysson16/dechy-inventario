import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { db, storage } from '../config/firebase';

const BranchManager = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    manager: '',
    status: 'Activo',
    image: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b'
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
    setFormData({ 
      name: '', 
      location: '', 
      manager: '', 
      status: 'Activo', 
      image: '',
      primaryColor: '#3b82f6',
      secondaryColor: '#64748b'
    });
    setImageFile(null);
    setUploadProgress(0);
    setIsModalOpen(true);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location,
      manager: branch.manager,
      status: branch.status || 'Activo',
      image: branch.image || '',
      primaryColor: branch.primaryColor || '#3b82f6',
      secondaryColor: branch.secondaryColor || '#64748b'
    });
    setImageFile(null);
    setUploadProgress(0);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = formData.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNbT68GxPjS4Yd2BmnrLnjD5uksIDQxEFHqhLsIeoBrhvj0kUn262HCqg1NxG-LyDycMfg_xIwCIYLViYtRsJJDaHccNavYgBSAJydeoKJ5zxmBpFjQhODixqYH81CFN7mn51zNL7Y3sxY0zIs6Bvh0NcJ3GWH4CelzQuJEkxcm6rBxSPPV82L_jbtKRfO246-Gr4RByHnDO06LvKC6ZitW2nzU_zFy_y9r05kT61rztd30p3lGu3UqvQfH12gFGPB8p1B8cs5yEM';

      if (imageFile) {
        const storageRef = ref(storage, `branches/${Date.now()}_${imageFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      const branchData = {
        ...formData,
        image: imageUrl,
        color: formData.status === 'Activo' ? 'bg-green-500' : 'bg-slate-500',
        primaryColor: formData.primaryColor || '#3b82f6',
        secondaryColor: formData.secondaryColor || '#64748b'
      };

      if (editingBranch) {
        // Update
        await updateDoc(doc(db, "branches", editingBranch.id), branchData);
        toast.success("Empresa actualizada correctamente.");
      } else {
        // Create
        await addDoc(collection(db, "branches"), {
          ...branchData,
          stockLevel: 0
        });
        toast.success("Empresa creada correctamente.");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving branch:", error);
      toast.error("Error al guardar la empresa.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar esta sucursal?')) {
      try {
        await deleteDoc(doc(db, "branches", id));
        toast.success("Sucursal eliminada.");
      } catch (error) {
        console.error("Error deleting branch:", error);
        toast.error("Error al eliminar la sucursal.");
      }
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Empresas</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 hidden md:block">Supervise y administre sus puntos de venta y empresas.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={openAddModal}
                className="md:inline-flex gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25 w-full md:w-auto flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">add_business</span>
                <span>Nueva Empresa</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-screen-xl mx-auto">
            {loading ? (
               <div className="flex justify-center py-20">
                 <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {branches.map(branch => {
                   const isClosed = branch.status !== 'Activo';
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
                          <div className="flex items-center gap-1">
                            <Link to={`/sucursales/${branch.id}/croquis`} onClick={(e) => e.stopPropagation()} title="Configurar Croquis" className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors bg-indigo-50 dark:bg-indigo-900/20 mr-1 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[18px]">grid_view</span>
                            </Link>
                            <button onClick={() => openEditModal(branch)} title="Editar Empresa" className="p-1.5 text-slate-400 hover:text-primary rounded-lg transition-colors bg-slate-50 dark:bg-slate-800">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => handleDelete(branch.id)} title="Eliminar Empresa" className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors bg-rose-50 dark:bg-rose-900/20">
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
                      </div>
                    </div>
                  )
                })}

                {/* Add New Branch Card Placeholder */}
                <button onClick={openAddModal} className="bg-slate-50 dark:bg-slate-800/20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center p-6 gap-4 hover:border-primary hover:bg-primary/5 transition-all group min-h-[280px]">
                  <div className="size-16 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors">add_business</span>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900 dark:text-white">Registrar Empresa</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Expanda su red de negocios</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal correctly configured to take full screen with high z-index */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
              <div 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp max-h-[90vh] overflow-y-auto custom-scrollbar"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{editingBranch ? 'edit_square' : 'add_business'}</span>
                    {editingBranch ? 'Editar Empresa' : 'Nueva Empresa'}
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Color Primario</label>
                         <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800">
                           <input 
                             type="color" 
                             value={formData.primaryColor}
                             onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                             className="size-8 rounded cursor-pointer border-none p-0 bg-transparent"
                           />
                           <span className="text-xs font-mono text-slate-500">{formData.primaryColor}</span>
                         </div>
                      </div>
                      <div>
                         <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Color Secundario</label>
                         <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-2 dark:bg-slate-800">
                           <input 
                             type="color" 
                             value={formData.secondaryColor}
                             onChange={(e) => setFormData({...formData, secondaryColor: e.target.value})}
                             className="size-8 rounded cursor-pointer border-none p-0 bg-transparent"
                           />
                           <span className="text-xs font-mono text-slate-500">{formData.secondaryColor}</span>
                         </div>
                      </div>
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
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Logo de la Empresa</label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageChange} 
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all dark:file:bg-primary/20 dark:file:text-primary"
                      />
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 dark:bg-slate-700">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      )}
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
