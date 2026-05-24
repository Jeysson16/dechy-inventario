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
  const [bannerHeroFile, setBannerHeroFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    manager: '',
    status: 'Activo',
    image: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b',
    description: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    bannerHero: '',
    categoriaImagenes: {},
    telefono: '',
    correo: '',
    inspiracionTitulo: '',
    inspiracionDescripcion: '',
    inspiracionImagenes: ['', '', '', '']
  });

  const [newCatName, setNewCatName] = useState('');
  const [newCatUrl, setNewCatUrl] = useState('');

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
      secondaryColor: '#64748b',
      description: '',
      facebook: '',
      instagram: '',
      whatsapp: '',
      bannerHero: '',
      categoriaImagenes: {},
      telefono: '',
      correo: '',
      inspiracionTitulo: '',
      inspiracionDescripcion: '',
      inspiracionImagenes: ['', '', '', '']
    });
    setImageFile(null);
    setBannerHeroFile(null);
    setNewCatName('');
    setNewCatUrl('');
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
      image: branch.configuracion?.logo || branch.image || '',
      primaryColor: branch.configuracion?.colores?.primario || branch.primaryColor || '#3b82f6',
      secondaryColor: branch.configuracion?.colores?.secundario || branch.secondaryColor || '#64748b',
      description: branch.configuracion?.descripcion || '',
      facebook: branch.configuracion?.redes_sociales?.facebook || '',
      instagram: branch.configuracion?.redes_sociales?.instagram || '',
      whatsapp: branch.configuracion?.redes_sociales?.whatsapp || '',
      bannerHero: branch.configuracion?.bannerHero || '',
      categoriaImagenes: branch.configuracion?.categoriaImagenes || {},
      telefono: branch.configuracion?.contacto?.telefono || branch.telefono || '',
      correo: branch.configuracion?.contacto?.correo || branch.correo || '',
      inspiracionTitulo: branch.configuracion?.inspiracion?.titulo || '',
      inspiracionDescripcion: branch.configuracion?.inspiracion?.descripcion || '',
      inspiracionImagenes: branch.configuracion?.inspiracion?.imagenes?.length === 4 
        ? branch.configuracion.inspiracion.imagenes 
        : [
            branch.configuracion?.inspiracion?.imagenes?.[0] || '',
            branch.configuracion?.inspiracion?.imagenes?.[1] || '',
            branch.configuracion?.inspiracion?.imagenes?.[2] || '',
            branch.configuracion?.inspiracion?.imagenes?.[3] || ''
          ]
    });
    setImageFile(null);
    setBannerHeroFile(null);
    setNewCatName('');
    setNewCatUrl('');
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

  const handleBannerChange = (e) => {
    if (e.target.files[0]) {
      setBannerHeroFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = formData.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNbT68GxPjS4Yd2BmnrLnjD5uksIDQxEFHqhLsIeoBrhvj0kUn262HCqg1NxG-LyDycMfg_xIwCIYLViYtRsJJDaHccNavYgBSAJydeoKJ5zxmBpFjQhODixqYH81CFN7mn51zNL7Y3sxY0zIs6Bvh0NcJ3GWH4CelzQuJEkxcm6rBxSPPV82L_jbtKRfO246-Gr4RByHnDO06LvKC6ZitW2nzU_zFy_y9r05kT61rztd30p3lGu3UqvQfH12gFGPB8p1B8cs5yEM';
      let bannerHeroUrl = formData.bannerHero || '';

      // Upload Logo
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

      // Upload Custom Banner
      if (bannerHeroFile) {
        const storageRef = ref(storage, `branches/banners/${Date.now()}_${bannerHeroFile.name}`);
        const uploadTask = uploadBytesResumable(storageRef, bannerHeroFile);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            null,
            (error) => reject(error),
            async () => {
              bannerHeroUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }

      const branchData = {
        name: formData.name,
        location: formData.location,
        manager: formData.manager,
        status: formData.status,
        image: imageUrl,
        color: formData.status === 'Activo' ? 'bg-green-500' : 'bg-slate-500',
        configuracion: {
          logo: imageUrl,
          bannerHero: bannerHeroUrl,
          categoriaImagenes: formData.categoriaImagenes || {},
          colores: {
            primario: formData.primaryColor || '#3b82f6',
            secundario: formData.secondaryColor || '#64748b'
          },
          descripcion: formData.description || '',
          contacto: {
            telefono: formData.telefono || '',
            correo: formData.correo || '',
            direccion: formData.location || ''
          },
          redes_sociales: {
            facebook: formData.facebook || '',
            instagram: formData.instagram || '',
            whatsapp: formData.whatsapp || ''
          },
          inspiracion: {
            titulo: formData.inspiracionTitulo || '',
            descripcion: formData.inspiracionDescripcion || '',
            imagenes: formData.inspiracionImagenes || ['', '', '', '']
          }
        }
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
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Dirección / Ubicación (Calle, Ciudad)</label>
                      <input 
                        required 
                        type="text" 
                        value={formData.location} 
                        onChange={(e) => setFormData({...formData, location: e.target.value})} 
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                        placeholder="Ej. Av. Principal 123, San Isidro" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Gerente / Administrador</label>
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
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Teléfono Público</label>
                        <input 
                          type="text" 
                          value={formData.telefono} 
                          onChange={(e) => setFormData({...formData, telefono: e.target.value})} 
                          className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                          placeholder="Ej. +51 999 888 777" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Correo Público</label>
                        <input 
                          type="email" 
                          value={formData.correo} 
                          onChange={(e) => setFormData({...formData, correo: e.target.value})} 
                          className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                          placeholder="Ej. contacto@decordechy.pe" 
                        />
                      </div>
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
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción para Landing / Catálogo</label>
                      <textarea 
                        value={formData.description} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none h-24" 
                        placeholder="Descripción breve que aparecerá en la cabecera de la sucursal..." 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Redes Sociales (URLs)</label>
                      <div className="flex flex-col gap-3">
                        <input 
                          type="url" 
                          value={formData.facebook} 
                          onChange={(e) => setFormData({...formData, facebook: e.target.value})} 
                          className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm" 
                          placeholder="Facebook URL (Ej. https://facebook.com/...)" 
                        />
                        <input 
                          type="url" 
                          value={formData.instagram} 
                          onChange={(e) => setFormData({...formData, instagram: e.target.value})} 
                          className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm" 
                          placeholder="Instagram URL (Ej. https://instagram.com/...)" 
                        />
                        <input 
                          type="url" 
                          value={formData.whatsapp} 
                          onChange={(e) => setFormData({...formData, whatsapp: e.target.value})} 
                          className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm" 
                          placeholder="WhatsApp Link (Ej. https://wa.me/51...)" 
                        />
                      </div>
                    </div>
                    
                    {/* BANNERS SECTION */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Banner del Catálogo</h4>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Subir Imagen de Banner (Hero)</label>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleBannerChange} 
                          className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all dark:file:bg-primary/20 dark:file:text-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">O usar una URL directa de Banner</label>
                        <input 
                          type="url" 
                          value={formData.bannerHero} 
                          onChange={(e) => setFormData({...formData, bannerHero: e.target.value})} 
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                          placeholder="Ej. https://miservidor.com/mi_banner.jpg" 
                        />
                      </div>
                    </div>

                    {/* DYNAMIC CATEGORY IMAGES SECTION */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Imágenes de Categorías</h4>
                      
                      {/* Active category images */}
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {Object.keys(formData.categoriaImagenes || {}).length === 0 ? (
                          <p className="text-xs text-slate-400 font-light">No hay imágenes de categorías asignadas. Se usarán imágenes estándar.</p>
                        ) : (
                          Object.entries(formData.categoriaImagenes || {}).map(([catName, imgUrl]) => (
                            <div key={catName} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-750">
                              <span className="text-xs font-bold text-slate-850 dark:text-slate-200 capitalize flex-1">{catName}</span>
                              <span className="text-[10px] text-slate-450 truncate max-w-[140px] font-mono">{imgUrl}</span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  const copy = { ...formData.categoriaImagenes };
                                  delete copy[catName];
                                  setFormData({ ...formData, categoriaImagenes: copy });
                                }} 
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add new pair */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nueva Imagen de Categoría</p>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="Categoría (Ej. SPC)" 
                            className="w-1/3 p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-850 text-xs outline-none"
                          />
                          <input 
                            type="url"
                            value={newCatUrl}
                            onChange={(e) => setNewCatUrl(e.target.value)}
                            placeholder="URL de Imagen" 
                            className="flex-1 p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-850 text-xs outline-none"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (!newCatName || !newCatUrl) return;
                              const updated = {
                                ...formData.categoriaImagenes,
                                [newCatName.trim()]: newCatUrl.trim()
                              };
                              setFormData({ ...formData, categoriaImagenes: updated });
                              setNewCatName('');
                              setNewCatUrl('');
                            }}
                            className="px-3 bg-primary text-white text-xs font-bold rounded hover:bg-primary/95 transition-colors"
                          >
                            Añadir
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC INSPIRATION SECTION */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Sección de Inspiración (Gallería de Tendencias)</h4>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Título de Inspiración</label>
                        <input 
                          type="text" 
                          value={formData.inspiracionTitulo} 
                          onChange={(e) => setFormData({...formData, inspiracionTitulo: e.target.value})} 
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all" 
                          placeholder="Ej. Inspírate y crea espacios únicos" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Descripción de Inspiración</label>
                        <textarea 
                          value={formData.inspiracionDescripcion} 
                          onChange={(e) => setFormData({...formData, inspiracionDescripcion: e.target.value})} 
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none h-16" 
                          placeholder="Descripción breve sobre las tendencias de diseño..." 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Imágenes de Inspiración (Máximo 4)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[0, 1, 2, 3].map((idx) => (
                            <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700 space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Imagen {idx + 1}</span>
                                {formData.inspiracionImagenes?.[idx] && (
                                  <a href={formData.inspiracionImagenes[idx]} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary hover:underline">Ver Imagen</a>
                                )}
                              </div>
                              <input 
                                type="url" 
                                value={formData.inspiracionImagenes?.[idx] || ''} 
                                onChange={(e) => {
                                  const updated = [...formData.inspiracionImagenes];
                                  updated[idx] = e.target.value;
                                  setFormData({ ...formData, inspiracionImagenes: updated });
                                }}
                                className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-850 text-[11px] outline-none" 
                                placeholder={`URL de Imagen ${idx + 1}`}
                              />
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={async (e) => {
                                  if (e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const toastId = toast.loading(`Subiendo imagen ${idx + 1}...`);
                                    try {
                                      const storageRef = ref(storage, `branches/inspiration/${Date.now()}_${file.name}`);
                                      const uploadTask = uploadBytesResumable(storageRef, file);
                                      await new Promise((resolve, reject) => {
                                        uploadTask.on('state_changed', null, reject, resolve);
                                      });
                                      const downloadUrl = await getDownloadURL(storageRef);
                                      const updated = [...formData.inspiracionImagenes];
                                      updated[idx] = downloadUrl;
                                      setFormData({ ...formData, inspiracionImagenes: updated });
                                      toast.success(`Imagen ${idx + 1} subida con éxito!`, { id: toastId });
                                    } catch (err) {
                                      console.error(err);
                                      toast.error(`Error al subir imagen ${idx + 1}.`, { id: toastId });
                                    }
                                  }
                                }}
                                className="w-full text-[9px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
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
