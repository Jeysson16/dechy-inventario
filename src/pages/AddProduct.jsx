import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { db, storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    description: '',
    length: '',
    width: '',
    height: '',
    unitsPerBox: '',
    unitPrice: '',
    boxPrice: '',
    initialStock: ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [categories, setCategories] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const navigate = useNavigate();
  const { currentBranch } = useAuth(); // Context branch

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "categories"), (querySnapshot) => {
      const catsData = [];
      querySnapshot.forEach((doc) => {
        catsData.push({ id: doc.id, ...doc.data() });
      });
      setCategories(catsData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        createdAt: new Date()
      });
      setFormData({ ...formData, category: newCategoryName.trim() });
      setIsCategoryModalOpen(false);
      setNewCategoryName('');
      toast.success('Categoría creada correctamente.');
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Error al crear la categoría.");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddAnother = () => {
    setFormData({
      name: '',
      category: '',
      sku: '',
      description: '',
      length: '',
      width: '',
      height: '',
      unitsPerBox: '',
      unitPrice: '',
      boxPrice: '',
      initialStock: ''
    });
    setFile(null);
    setPreview(null);
    setUploadProgress(0);
    setIsSuccessModalOpen(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = null;
      if (file) {
        const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        imageUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      }

      const productData = {
        ...formData,
        length: Number(formData.length),
        width: Number(formData.width),
        height: Number(formData.height),
        dimensions: `${formData.length}x${formData.width}x${formData.height} cm`,
        unitsPerBox: Number(formData.unitsPerBox),
        unitPrice: Number(formData.unitPrice),
        boxPrice: Number(formData.boxPrice),
        price: Number(formData.unitPrice), // For compatibility
        currentStock: Number(formData.initialStock),
        stock: Number(formData.initialStock), // For compatibility
        branch: currentBranch.id, // Auto-bind to the active branch context
        imageUrl,
        createdAt: new Date(),
        status: Number(formData.initialStock) > 20 ? 'Disponible' : (Number(formData.initialStock) > 0 ? 'Stock Bajo' : 'Agotado')
      };

      await addDoc(collection(db, 'products'), productData);
      setLoading(false);
      setIsSuccessModalOpen(true);
      toast.success('Producto registrado correctamente.');
    } catch (error) {
      console.error("Error adding product: ", error);
      toast.error('Hubo un error al registrar el producto.');
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-1 justify-center py-8 px-4 md:px-0 animate-fadeIn">
        <div className="flex flex-col max-w-[960px] w-full flex-1">
          {/* Page Header */}
          <div className="flex flex-col gap-2 p-4 mb-6">
            <h1 className="text-slate-900 text-4xl font-black leading-tight tracking-tight">Registrar Producto</h1>
            <p className="text-slate-500 text-lg font-normal leading-normal">Complete todos los campos para añadir un nuevo artículo al catálogo.</p>
          </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">info</span>
                  Información General
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Nombre del Producto</label>
                    <input name="name" value={formData.name} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. Panel de Pared Elegance Gold" type="text"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Categoría</label>
                    <div className="flex gap-2">
                      <select name="category" value={formData.category} onChange={handleChange} required className="w-full flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3">
                        <option value="" disabled>Seleccione una categoría</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="w-12 h-[50px] bg-primary/10 text-primary rounded-lg border border-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors shrink-0"
                        title="Nueva Categoría"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Modelo / SKU</label>
                    <input name="sku" value={formData.sku} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. MOD-2024-X-01" type="text"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Sucursal de Destino</label>
                    <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-sm">storefront</span>
                      </div>
                      <div>
                        <p className="text-slate-900 dark:text-white font-bold leading-tight">{currentBranch?.name || 'Sede Principal'}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Asignación automática</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Descripción Detallada</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Describa el acabado, material y usos recomendados..." rows="4"></textarea>
                </div>
              </div>

              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">straighten</span>
                  Dimensiones, Precios y Stock
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pb-6 border-b border-slate-200 border-dashed">
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Largo (cm)</label>
                    <input name="length" value={formData.length} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. 120" type="number" step="0.1" min="0"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Ancho (cm)</label>
                    <input name="width" value={formData.width} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. 60" type="number" step="0.1" min="0"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Alto / Espesor (cm/mm)</label>
                    <input name="height" value={formData.height} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. 0.5" type="number" step="0.1" min="0"/>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Cantidad por Caja</label>
                    <div className="flex items-center">
                      <input name="unitsPerBox" value={formData.unitsPerBox} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="0" type="number" min="1"/>
                      <span className="ml-3 text-slate-500 text-sm">u.</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Precio Unitario</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">S/</span>
                      <input name="unitPrice" value={formData.unitPrice} onChange={handleChange} required className="w-full pl-8 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="0.00" type="number" step="0.01" min="0"/>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Precio por Caja</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">S/</span>
                      <input name="boxPrice" value={formData.boxPrice} onChange={handleChange} required className="w-full pl-8 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="0.00" type="number" step="0.01" min="0"/>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Stock Inicial</label>
                    <div className="flex items-center">
                      <input name="initialStock" value={formData.initialStock} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="0" type="number" min="0"/>
                      <span className="ml-3 text-slate-500 text-sm">Cajas</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">image</span>
                  Galería de Imágenes
                </h3>
                
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 min-h-[300px] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group relative overflow-hidden" onClick={() => document.getElementById('fileUpload').click()}>
                  {preview ? (
                    <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-4" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-5xl mb-4 group-hover:scale-110 transition-transform">upload_file</span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-center">Haga clic o arrastre para subir fotos del producto</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 text-center">Formatos aceptados: PNG, JPG, WEBP. Tamaño máx: 5MB.</p>
                    </>
                  )}
                  <input id="fileUpload" className="hidden" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                </div>
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-4">
                <button type="button" onClick={() => navigate('/inventario')} className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-8 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-light shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 hover:scale-105">
                  <span className="material-symbols-outlined text-xl">save</span>
                  Registrar Producto
                </button>
              </div>
            </form>

            {/* Help Text */}
            <div className="mt-8 mb-12 flex items-start gap-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <span className="material-symbols-outlined text-primary">help</span>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-semibold text-primary mb-1">¿Necesita ayuda con el registro?</p>
                <p>Asegúrese de que las medidas estén expresadas en el sistema métrico para mantener la consistencia en el catálogo. Las fotos de alta resolución ayudan a los clientes a apreciar mejor las texturas de los paneles.</p>
              </div>
            </div>
        </div>
      </div>

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">category</span>
                Nueva Categoría
              </h3>
              <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5">
              <div className="flex flex-col gap-2 mb-6">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Nombre de Categoría</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                  className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" 
                  placeholder="Ej. Pisos Laminados" 
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="px-5 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Crear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 text-center p-8 flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-primary text-5xl mb-4">progress_activity</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Guardando Producto</h3>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              Por favor, espera mientras se {file ? 'sube la imagen y se registran' : 'registran'} los datos...
            </p>
            {file && uploadProgress > 0 && (
              <div className="w-full mt-6 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}
            {file && uploadProgress > 0 && (
               <span className="text-sm text-slate-500 mt-2 font-bold">{Math.round(uploadProgress)}%</span>
            )}
          </div>
        </div>
      )}

      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp text-center p-8">
            <div className="size-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">¡Producto Registrado!</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 font-medium">
              El producto se ha guardado correctamente en la base de datos y ya está disponible en el inventario.
            </p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => navigate('/inventario')} className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">inventory_2</span>
                Ir al Listado de Inventario
              </button>
              <button type="button" onClick={handleAddAnother} className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">add_circle</span>
                Registrar Otro Producto
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default AddProduct;
