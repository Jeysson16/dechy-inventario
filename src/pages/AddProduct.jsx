import { addDoc, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
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
    initialStock: '',
    locations: {}
  });
  const [images, setImages] = useState([]); // Array of { file: File | null, preview: string, isMain: boolean, id?: string }
  const [uploadProgress, setUploadProgress] = useState(0);

  const [categories, setCategories] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [branchLayout, setBranchLayout] = useState(null);
  const [originalStock, setOriginalStock] = useState(0);


  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { currentUser, currentBranch, userProfile } = useAuth();
  const [loading, setLoading] = useState(isEditing);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("No se pudo acceder a la cámara. Verifique los permisos.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const newPreview = URL.createObjectURL(file);
        setImages(prev => [
            ...prev, 
            { file, preview: newPreview, isMain: prev.length === 0 }
        ]);
        stopCamera();
      }, 'image/jpeg');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      try {
        const querySnapshot = await getDocs(collection(db, 'categories'));
        const cats = [];
        querySnapshot.forEach((doc) => {
          cats.push({ id: doc.id, ...doc.data() });
        });
        setCategories(cats);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }

      // Fetch branch layout
      if (currentBranch) {
        try {
          const branchDoc = await getDoc(doc(db, 'branches', currentBranch.id));
          if (branchDoc.exists() && branchDoc.data().layout) {
            setBranchLayout(branchDoc.data().layout);
          }
        } catch (error) {
          console.error("Error fetching branch layout:", error);
        }
      }

      if (isEditing) {
        try {
          const productDoc = await getDoc(doc(db, 'products', id));
          if (productDoc.exists()) {
            const data = productDoc.data();
            setFormData({
              name: data.name || '',
              category: data.category || '',
              sku: data.sku || '',
              description: data.description || '',
              length: data.length || '',
              width: data.width || '',
              height: data.height || '',
              unitsPerBox: data.unitsPerBox || '',
              unitPrice: data.unitPrice || data.price || '',
              boxPrice: data.boxPrice || '',
              initialStock: data.currentStock || data.stock || '',
              locations: data.locations || {}
            });
            setOriginalStock(Number(data.currentStock || data.stock || 0));
            
            // Handle images
            if (data.imageUrls && data.imageUrls.length > 0) {
              const loadedImages = data.imageUrls.map(url => ({
                  file: null,
                  preview: url,
                  isMain: url === data.imageUrl || url === data.mainImageUrl
              }));
              setImages(loadedImages);
            } else if (data.imageUrl) {
              setImages([{ file: null, preview: data.imageUrl, isMain: true }]);
            }

          } else {
            toast.error('Producto no encontrado.');
            navigate('/inventario');
          }
        } catch (error) {
          console.error("Error fetching product:", error);
          toast.error('Hubo un error al cargar el producto.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [id, isEditing, navigate, currentBranch]);



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
      // Refresh categories
      const querySnapshot = await getDocs(collection(db, 'categories'));
      const cats = [];
      querySnapshot.forEach((doc) => {
        cats.push({ id: doc.id, ...doc.data() });
      });
      setCategories(cats);
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
      initialStock: '',
      locations: {}
    });
    setImages([]);

    setUploadProgress(0);
    setIsSuccessModalOpen(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newImages = newFiles.map((file, index) => ({
        file: file,
        preview: URL.createObjectURL(file),
        isMain: images.length === 0 && index === 0
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const handleSetMainImage = (index) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isMain: i === index
    })));
  };

  const handleDeleteImage = (index) => {
    setImages(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      // If we deleted the main image, set the first one as main
      if (prev[index].isMain && filtered.length > 0) {
        filtered[0].isMain = true;
      }
      return filtered;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const uploadedUrls = await Promise.all(images.map(async (img) => {
        if (img.file) {
          const storageRef = ref(storage, `products/${Date.now()}_${img.file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, img.file);
          
          return new Promise((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                // Approximate progress for multiple files
                // This is a simple version, ideally we'd track each one
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
              },
              (error) => reject(error),
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              }
            );
          });
        }
        return img.preview; // Keep existing URL
      }));

      const mainImage = images.find(img => img.isMain)?.preview || uploadedUrls[0] || null;
      // If the main image was newly uploaded, we need to find its URL in uploadedUrls
      // actually, above logic is slightly flawed for mixed existing/new. 
      // Let's refine:
      
      const imageUrls = uploadedUrls.filter(url => !!url);
      const mainImageUrl = uploadedUrls[images.findIndex(img => img.isMain)] || imageUrls[0] || null;

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
        branch: currentBranch.id,
        imageUrl: mainImageUrl,
        mainImageUrl: mainImageUrl,
        imageUrls: imageUrls,
        locations: isEditing ? (formData.locations || {}) : {},
        status: Number(formData.initialStock) > 20 ? 'Disponible' : (Number(formData.initialStock) > 0 ? 'Stock Bajo' : 'Agotado'),
        updatedAt: new Date()
      };

      if (isEditing) {
        await updateDoc(doc(db, 'products', id), productData);
        
        // Log transaction if stock changed
        const newStock = Number(formData.initialStock);
        if (newStock !== originalStock) {
          const diff = newStock - originalStock;
          await addDoc(collection(db, 'transactions'), {
            productId: id,
            type: diff > 0 ? 'entrada' : 'salida',
            quantityBoxes: Math.abs(diff),
            quantityUnits: 0,
            userEmail: currentUser.email,
            userName: userProfile?.name || currentUser.displayName || currentUser.email,
            date: new Date(),
            newStock: newStock,
            branchId: currentBranch.id,
            note: 'Ajuste manual en edición'
          });
        }

        toast.success('Producto actualizado correctamente.');
      } else {
        const docRef = await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date()
        });
        
        // Log initial stock transaction
        if (Number(formData.initialStock) > 0) {
          await addDoc(collection(db, 'transactions'), {
            productId: docRef.id,
            type: 'entrada',
            quantityBoxes: Number(formData.initialStock),
            quantityUnits: 0,
            userEmail: currentUser.email,
            userName: userProfile?.name || currentUser.displayName || currentUser.email,
            date: new Date(),
            newStock: Number(formData.initialStock),
            branchId: currentBranch.id,
            note: 'Stock inicial'
          });
        }

        toast.success('Producto registrado correctamente.');
      }

      setLoading(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error("Error saving product: ", error);
      toast.error('Hubo un error al guardar el producto.');
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-1 py-8 px-4 md:px-8 lg:px-12 animate-fadeIn w-full">
        <div className="flex flex-col w-full flex-1">
          {/* Page Header */}
          <div className="flex flex-col gap-2 p-4 mb-6">
            <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-tight">
              {isEditing ? 'Editar Producto' : 'Registrar Producto'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-normal leading-normal">
              {isEditing ? 'Modifique los campos necesarios para actualizar el catálogo.' : 'Complete todos los campos para añadir un nuevo artículo al catálogo.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 relative pb-0 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary">info</span>
                Información General
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Nombre del Producto</label>
                  <input name="name" value={formData.name} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary p-3" placeholder="Ej. Panel de Pared Elegance Gold" type="text"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Categoría</label>
                  <div className="flex gap-2">
                    <select name="category" value={formData.category} onChange={handleChange} required className="w-full flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary p-3">
                      <option value="" disabled>Seleccione una categoría</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="w-12 h-[50px] bg-primary/10 text-primary rounded-lg border border-primary/20 flex items-center justify-center hover:bg-primary hover:text-white transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Modelo / SKU</label>
                  <input name="sku" value={formData.sku} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary p-3" placeholder="Ej. MOD-2024-X-01" type="text"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Sucursal</label>
                  <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-sm">storefront</span>
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-white font-bold">{currentBranch?.name || 'Sede Principal'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Descripción</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary focus:border-primary p-3" placeholder="Detalle del producto..."></textarea>
              </div>
            </div>

            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary">straighten</span>
                Dimensiones, Precios y Stock
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Largo (cm)</label>
                  <input name="length" value={formData.length} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="Ej. 120" type="number" step="0.1"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Ancho (cm)</label>
                  <input name="width" value={formData.width} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="Ej. 60" type="number" step="0.1"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Alto / Espesor (cm/mm)</label>
                  <input name="height" value={formData.height} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="Ej. 0.5" type="number" step="0.1"/>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Cantidad por Caja</label>
                  <div className="flex items-center gap-2">
                    <input name="unitsPerBox" value={formData.unitsPerBox} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="0" type="number"/>
                    <span className="text-slate-400 text-sm font-medium">u.</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Precio Unitario</label>
                  <input name="unitPrice" value={formData.unitPrice} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="S/ 0.00" type="number" step="0.01"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Precio por Caja</label>
                  <input name="boxPrice" value={formData.boxPrice} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="S/ 0.00" type="number" step="0.01"/>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">{isEditing ? 'Stock Actual' : 'Stock Inicial'}</label>
                  <div className="flex items-center gap-2">
                    <input name="initialStock" value={formData.initialStock} onChange={handleChange} required className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 transition-colors focus:ring-1 focus:ring-primary focus:border-primary px-4" placeholder="0" type="number"/>
                    <span className="text-slate-400 text-sm font-medium">Cajas</span>
                  </div>
                </div>
              </div>
            </div>



            <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary">image</span>
                Gallería de Imágenes
              </h3>
              
              <div className="flex flex-col gap-6">
                {/* Image Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {images.map((img, index) => (
                    <div 
                      key={index} 
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 group transition-all duration-300 ${
                        img.isMain ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <img src={img.preview} alt={`Producto ${index}`} className="w-full h-full object-cover"/>
                      
                      {/* Toolbars */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        {!img.isMain && (
                          <button 
                            type="button" 
                            onClick={() => handleSetMainImage(index)}
                            className="bg-primary text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-3 rounded-full hover:scale-105 active:scale-95 transition-transform"
                          >
                            Set Principal
                          </button>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleDeleteImage(index)}
                          className="bg-rose-500 text-white p-2 rounded-full hover:bg-rose-600 transition-colors hover:scale-110"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>

                      {/* Status Badges */}
                      {img.isMain && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded shadow-sm">
                          Principal
                        </div>
                      )}
                      {img.file && (
                        <div className="absolute bottom-2 right-2 size-2 bg-blue-500 rounded-full border border-white dark:border-slate-900 shadow-sm" title="Nueva imagen"></div>
                      )}
                    </div>
                  ))}

                  {/* Add Image Button */}
                  <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group group-active:scale-[0.98]">
                    <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors">add_photo_alternate</span>
                    <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-primary tracking-widest">Añadir</span>
                    <input type="file" onChange={handleFileChange} multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"/>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <button type="button" onClick={startCamera} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800">
                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                    Usar Cámara
                  </button>
                </div>
                
                <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-start gap-4 w-full">
                  <div className="size-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <span className="material-symbols-outlined text-2xl">tips_and_updates</span>
                  </div>
                  <div>
                    <h4 className="text-indigo-900 dark:text-indigo-100 font-bold text-sm mb-1 uppercase tracking-tight">Consejo</h4>
                    <p className="text-indigo-700 dark:text-indigo-300 text-xs leading-relaxed font-medium">
                      Suba varias fotos desde distintos ángulos. Marque la mejor foto como **Principal** para que aparezca en el listado principal del inventario.
                    </p>
                  </div>
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Sincronizando Galería...</span>
                      <span className="text-xs font-black text-primary">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden shadow-inner">
                      <div className="bg-primary h-full transition-all duration-300 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 md:p-8 flex items-center justify-end gap-4">
              <button type="button" onClick={() => navigate('/inventario')} className="px-6 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                Cancelar
              </button>
              <button disabled={loading} type="submit" className="px-10 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 disabled:opacity-50 disabled:translate-y-0">
                {loading ? (
                  <>
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{isEditing ? 'Actualizando...' : 'Registrando...'}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">save</span>
                    <span>{isEditing ? 'Guardar Cambios' : 'Registrar Producto'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCategoryModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md animate-scaleUp overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Nueva Categoría</h3>
            </div>
            <form onSubmit={handleAddCategory} className="p-6">
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-primary mb-6" placeholder="Nombre de la categoría..."/>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cerrar</button>
                <button type="submit" className="flex-1 py-3 font-black bg-primary text-white rounded-xl shadow-lg shadow-primary/20 transition-all">Crear Categoría</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10 text-center animate-scaleUp border border-slate-200 dark:border-slate-800">
            <div className="size-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">
              {isEditing ? '¡Actualización Exitosa!' : '¡Producto Registrado!'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg mb-10 leading-relaxed px-4">
              {isEditing ? 'Los cambios se han guardado correctamente en la base de datos.' : 'El producto ha sido añadido correctamente al catálogo de inventario.'}
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/inventario')} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all">
                Ir al Inventario
              </button>
              {!isEditing && (
                <button onClick={handleAddAnother} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                  Registrar Otro Producto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
            <div className="relative aspect-[4/3] bg-black">
               <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
               <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            <div className="p-8 flex items-center justify-center gap-12 bg-slate-900 border-t border-slate-800">
               <button type="button" onClick={stopCamera} className="size-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all border border-slate-700">
                 <span className="material-symbols-outlined text-3xl">close</span>
               </button>
               <button type="button" onClick={capturePhoto} className="size-20 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/20 relative group">
                 <div className="size-16 rounded-full border-2 border-slate-900 group-active:bg-slate-200 transition-colors"></div>
               </button>
               <div className="size-14"></div> {/* Spacer to center the capture button */}
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
};

export default AddProduct;
