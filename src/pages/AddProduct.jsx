import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    sku: '',
    branch: '',
    description: '',
    dimensions: '',
    unitsPerBox: '',
    initialStock: ''
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const navigate = useNavigate();
  const { currentBranch } = useAuth(); // default branch if not selected

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        unitsPerBox: Number(formData.unitsPerBox),
        currentStock: Number(formData.initialStock),
        imageUrl,
        createdAt: new Date(),
        status: Number(formData.initialStock) > 20 ? 'Disponible' : (Number(formData.initialStock) > 0 ? 'Stock Bajo' : 'Agotado')
      };

      await addDoc(collection(db, 'products'), productData);
      navigate('/inventario');
    } catch (error) {
      console.error("Error adding product: ", error);
      alert('Hubo un error al registrar el producto.');
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
                    <select name="category" value={formData.category} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3">
                      <option value="" disabled>Seleccione una categoría</option>
                      <option value="wall-panel">Wall Panel</option>
                      <option value="pvc">PVC</option>
                      <option value="spc">SPC</option>
                      <option value="moldings">Molduras</option>
                      <option value="accessories">Accesorios</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Modelo / SKU</label>
                    <input name="sku" value={formData.sku} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. MOD-2024-X-01" type="text"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Sucursal</label>
                    <select name="branch" value={formData.branch} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-primary focus:border-primary p-3">
                      <option value="" disabled>Seleccione sucursal de destino</option>
                      <option value="central">Sede Central</option>
                      <option value="norte">Sucursal Norte</option>
                      <option value="sur">Sucursal Sur</option>
                    </select>
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
                  Dimensiones y Stock
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Medidas (cm/m)</label>
                    <input name="dimensions" value={formData.dimensions} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="Ej. 120cm x 30cm" type="text"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Cantidad por Caja</label>
                    <div className="flex items-center">
                      <input name="unitsPerBox" value={formData.unitsPerBox} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-primary focus:border-primary p-3" placeholder="0" type="number" min="1"/>
                      <span className="ml-3 text-slate-500 text-sm">u.</span>
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
                
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group relative overflow-hidden" onClick={() => document.getElementById('fileUpload').click()}>
                  {preview ? (
                    <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-contain p-2" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-5xl mb-4 group-hover:scale-110 transition-transform">upload_file</span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold">Haga clic o arrastre para subir fotos del producto</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Formatos aceptados: PNG, JPG, WEBP. Tamaño máx: 5MB.</p>
                    </>
                  )}
                  <input id="fileUpload" className="hidden" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                </div>
                
                {loading && uploadProgress > 0 && (
                  <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                )}
              </div>

              <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-4">
                <button type="button" onClick={() => navigate('/inventario')} className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-8 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary-light shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-xl">save</span>
                  )}
                  {loading ? 'Subiendo...' : 'Registrar Producto'}
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
    </AppLayout>
  );
};

export default AddProduct;
