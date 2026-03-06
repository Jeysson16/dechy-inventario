import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const StockEntry = () => {
  const { currentUser, currentBranch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [branchLayout, setBranchLayout] = useState(null);
  
  // Selection State
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [activeTab, setActiveTab] = useState('entry'); // 'entry' | 'transfer'
  const [transferDestination, setTransferDestination] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Info Drawer State
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [infoLocation, setInfoLocation] = useState(null);

  // Fetch Products & Layout
  useEffect(() => {
    if (!currentBranch) return;

    const q = query(collection(db, "products"), where("branch", "==", currentBranch.id));
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setLoading(false);
    });

    const branchDocRef = doc(db, "branches", currentBranch.id);
    const unsubscribeLayout = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists() && snap.data().layout) {
        setBranchLayout(snap.data().layout);
      }
    });

    return () => {
      unsubscribeProducts();
      unsubscribeLayout();
    };
  }, [currentBranch]);

  // Compute occupied locations for visualization
  const locationMap = {};
  products.forEach(p => {
    if (p.locations) {
      Object.entries(p.locations).forEach(([key, qty]) => {
        locationMap[key] = (locationMap[key] || 0) + Number(qty);
      });
    }
  });

  const handleAreaClick = (shelfIdx, rowIdx, col) => {
    const key = `${shelfIdx}-${rowIdx}-${col}`;
    setSelectedLocation(key);
    // Reset form
    setSearchTerm('');
    setSelectedProduct(null);
    setQuantity('');
    setIsModalOpen(true);
    setActiveTab('entry');
    setTransferDestination('');
  };

  const handleInfoClick = (shelfIdx, rowIdx, col) => {
    const key = `${shelfIdx}-${rowIdx}-${col}`;
    setInfoLocation(key);
    setInfoDrawerOpen(true);
  };

  const productsInLocation = products.filter(p => p.locations && p.locations[selectedLocation] > 0);
  
  const productsInInfoLocation = infoLocation 
    ? products.filter(p => p.locations && p.locations[infoLocation] > 0)
    : [];

  const getAllDestinations = () => {
    if (!branchLayout) return [];
    const locs = [];
    branchLayout.shelves.forEach((shelf, sIdx) => {
      const sides = shelf.type === 'double' ? ['A', 'B'] : ['A'];
      sides.forEach(side => {
        for(let r=0; r < shelf.rows; r++) {
          const key = `${sIdx}-${r}-${side}`;
          // Exclude current location
          if (key !== selectedLocation) {
             locs.push({
               value: key,
               label: `${shelf.name} - Fila ${r+1} - Lado ${side}`
             });
          }
        }
      });
    });
    return locs;
  };

  const handleConfirmTransfer = async () => {
    if (!selectedProduct || !quantity || Number(quantity) <= 0 || !transferDestination) return;

    setIsProcessing(true);
    try {
      const qty = Number(quantity);
      const currentLocStock = Number(selectedProduct.locations[selectedLocation]) || 0;
      
      if (qty > currentLocStock) {
        toast.error("La cantidad excede el stock disponible en esta ubicación");
        setIsProcessing(false);
        return;
      }

      const productRef = doc(db, "products", selectedProduct.id);
      const newLocations = { ...selectedProduct.locations };
      
      // Update Origin
      newLocations[selectedLocation] = currentLocStock - qty;
      if (newLocations[selectedLocation] <= 0) {
        delete newLocations[selectedLocation];
      }

      // Update Destination
      newLocations[transferDestination] = (Number(newLocations[transferDestination]) || 0) + qty;

      await updateDoc(productRef, {
        locations: newLocations,
        updatedAt: new Date()
      });

      // Log Transaction
      await addDoc(collection(db, "transactions"), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'TRASLADO',
        quantityBoxes: qty,
        quantityUnits: 0,
        userEmail: currentUser.email,
        user: currentUser.displayName || currentUser.email,
        branchId: currentBranch.id,
        date: new Date(),
        originLocation: selectedLocation,
        destinationLocation: transferDestination,
        note: 'Traslado interno de stock'
      });

      toast.success(`Trasladadas ${qty} cajas exitosamente`);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error moving stock:", error);
      toast.error("Error al trasladar stock.");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirmEntry = async () => {
    if (!selectedProduct || !quantity || Number(quantity) <= 0) return;
    
    setIsProcessing(true);
    try {
      const qty = Number(quantity);
      const currentStock = Number(selectedProduct.currentStock) || 0;
      const newStock = currentStock + qty;
      
      // Update Product
      const productRef = doc(db, "products", selectedProduct.id);
      const newLocations = { ...(selectedProduct.locations || {}) };
      newLocations[selectedLocation] = (Number(newLocations[selectedLocation]) || 0) + qty;

      await updateDoc(productRef, {
        currentStock: newStock,
        locations: newLocations,
        status: newStock > 20 ? 'Disponible' : newStock > 0 ? 'Stock Bajo' : 'Agotado',
        updatedAt: new Date()
      });

      // Log Transaction
      await addDoc(collection(db, "transactions"), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'entrada',
        quantityBoxes: qty,
        quantityUnits: 0,
        userEmail: currentUser.email,
        user: currentUser.displayName || currentUser.email,
        branchId: currentBranch.id,
        date: new Date(),
        newStock: newStock,
        location: selectedLocation,
        note: 'Ingreso manual por mapa'
      });

      toast.success(`Ingresadas ${qty} cajas a ${selectedProduct.name}`);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error processing entry:", error);
      toast.error("Error al procesar el ingreso.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-screen max-h-[calc(100vh-64px)] md:max-h-screen overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0 flex justify-between items-center z-20">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">move_to_inbox</span>
              Recepción de Mercadería
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Seleccione una ubicación en el mapa para ingresar stock.</p>
          </div>
          <button 
            onClick={() => navigate('/nuevo-producto')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add_box</span>
            <span>Producto Nuevo</span>
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/50 relative overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            </div>
          ) : branchLayout ? (
            <DraggableContainer>
              <div className="min-w-max p-20 origin-center">
                <LayoutPreview 
                  layout={branchLayout}
                  quantities={locationMap}
                  onAreaClick={handleAreaClick}
                  onInfoClick={handleInfoClick}
                  selectedAreas={selectedLocation ? [selectedLocation] : []}
                  showTooltips={true}
                />
              </div>
            </DraggableContainer>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <span className="material-symbols-outlined text-6xl mb-4">map</span>
               <p className="font-bold">No hay croquis configurado</p>
               <button onClick={() => navigate(`/sucursales/${currentBranch.id}/croquis`)} className="mt-4 text-primary font-bold hover:underline">Configurar ahora</button>
             </div>
          )}

          {/* Helper Badge */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 pointer-events-none">
            <span className="material-symbols-outlined text-primary animate-bounce">touch_app</span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Toque una ubicación para recibir stock</span>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    {activeTab === 'entry' ? 'input' : 'swap_horiz'}
                  </span>
                  {activeTab === 'entry' ? 'Ingresar Stock' : 'Trasladar Stock'}
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ubicación: {
                  (() => {
                    const [s, r, c] = selectedLocation.split('-');
                    return `Estante ${Number(s)+1} - Fila ${Number(r)+1} - Col ${c}`;
                  })()
                }</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setActiveTab('entry'); setSelectedProduct(null); setQuantity(''); }}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'entry' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Ingreso Nuevo
              </button>
              <button
                onClick={() => { setActiveTab('transfer'); setSelectedProduct(null); setQuantity(''); }}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'transfer' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Mover a Otra Área
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              {activeTab === 'entry' ? (
                /* ================= ENTRY MODE ================= */
                !selectedProduct ? (
                /* Product Search Step */
                <div className="space-y-4">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Buscar producto por nombre o SKU..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <p>No se encontraron productos.</p>
                        <button onClick={() => navigate('/nuevo-producto')} className="text-primary font-bold text-sm hover:underline mt-2">Registrar nuevo</button>
                      </div>
                    ) : (
                      filteredProducts.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => setSelectedProduct(p)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                        >
                          <div className="size-12 rounded-lg bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center p-1">
                            {p.imageUrl ? <img src={p.imageUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-slate-300">image</span>}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{p.name}</h4>
                            <p className="text-xs text-slate-500">{p.sku}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-400 uppercase">Stock</span>
                            <p className="font-black text-slate-800 dark:text-slate-200">{p.currentStock}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) :   
              (
                /* Quantity Step */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="size-16 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-600">
                      {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-slate-300 text-3xl">image</span>}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg">{selectedProduct.name}</h4>
                      <p className="text-sm text-slate-500">{selectedProduct.sku}</p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-primary text-sm font-bold hover:underline">Cambiar</button>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cantidad a Ingresar (Cajas)</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setQuantity(q => Math.max(0, (Number(q)||0)-1).toString())} className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined">remove</span>
                      </button>
                      <input 
                        autoFocus
                        type="number" 
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="flex-1 h-12 text-center text-2xl font-black bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 outline-none"
                        placeholder="0"
                      />
                      <button onClick={() => setQuantity(q => ((Number(q)||0)+1).toString())} className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex items-center gap-3">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">inventory</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Nuevo Stock Total</p>
                      <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{(Number(selectedProduct.currentStock) || 0) + (Number(quantity) || 0)} Cajas</p>
                    </div>
                  </div>
                </div>
              )) : (
                /* ================= TRANSFER MODE ================= */
                productsInLocation.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">block</span>
                    <p className="font-medium">No hay productos en esta ubicación para mover.</p>
                  </div>
                ) : !selectedProduct ? (
                  /* Transfer: Select Product */
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Productos en esta ubicación</p>
                    {productsInLocation.map(p => (
                       <button 
                         key={p.id}
                         onClick={() => { setSelectedProduct(p); setQuantity(''); setTransferDestination(''); }}
                         className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                       >
                         <div className="size-12 rounded-lg bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center p-1">
                           {p.imageUrl ? <img src={p.imageUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-slate-300">image</span>}
                         </div>
                         <div className="flex-1">
                           <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{p.name}</h4>
                           <p className="text-xs text-slate-500">{p.sku}</p>
                         </div>
                         <div className="text-right">
                           <span className="text-xs font-bold text-slate-400 uppercase">Aquí</span>
                           <p className="font-black text-slate-800 dark:text-slate-200">{p.locations[selectedLocation]}</p>
                         </div>
                         <span className="material-symbols-outlined text-slate-300 group-hover:text-primary">arrow_forward_ios</span>
                       </button>
                    ))}
                  </div>
                ) : (
                  /* Transfer: Quantity & Destination */
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    {/* Selected Product Header */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="size-16 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-600">
                        {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-slate-300 text-3xl">image</span>}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{selectedProduct.name}</h4>
                        <p className="text-sm text-slate-500">Disponible aquí: <span className="font-black text-slate-800 dark:text-white">{selectedProduct.locations[selectedLocation]}</span> cajas</p>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="text-primary text-sm font-bold hover:underline">Cambiar</button>
                    </div>

                    {/* Quantity Input */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cantidad a Mover</label>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setQuantity(q => Math.max(0, (Number(q)||0)-1).toString())} 
                          className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="material-symbols-outlined">remove</span>
                        </button>
                        <input 
                          autoFocus
                          type="number" 
                          min="0"
                          max={selectedProduct.locations[selectedLocation]}
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="flex-1 h-12 text-center text-2xl font-black bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 outline-none"
                          placeholder="0"
                        />
                        <button 
                          onClick={() => setQuantity(q => Math.min(selectedProduct.locations[selectedLocation], (Number(q)||0)+1).toString())} 
                          className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>
                      </div>
                    </div>

                    {/* Destination Selector */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Ubicación de Destino</label>
                      <select
                        value={transferDestination}
                        onChange={(e) => setTransferDestination(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold focus:border-primary focus:ring-0 outline-none"
                      >
                        <option value="">Seleccione destino...</option>
                        {getAllDestinations().map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
              
              {activeTab === 'entry' ? (
                selectedProduct && (
                  <button 
                    onClick={handleConfirmEntry}
                    disabled={!quantity || Number(quantity) <= 0 || isProcessing}
                    className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                  >
                    {isProcessing ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">check</span>}
                    Confirmar Ingreso
                  </button>
                )
              ) : (
                selectedProduct && (
                  <button 
                    onClick={handleConfirmTransfer}
                    disabled={!quantity || Number(quantity) <= 0 || !transferDestination || isProcessing}
                    className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                  >
                    {isProcessing ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">swap_horiz</span>}
                    Confirmar Traslado
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Drawer */}
      {infoDrawerOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" 
            onClick={() => setInfoDrawerOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 animate-slideLeft border-l border-slate-200 dark:border-slate-800 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">info</span>
                  Detalle de Ubicación
                </h3>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  {(() => {
                    if (!infoLocation) return '';
                    const [s, r, c] = infoLocation.split('-');
                    return `Estante ${Number(s)+1} - Fila ${Number(r)+1} - Col ${c}`;
                  })()}
                </p>
              </div>
              <button onClick={() => setInfoDrawerOpen(false)} className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {productsInInfoLocation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                  <span className="material-symbols-outlined text-5xl mb-4 opacity-50">inbox_customize</span>
                  <p className="font-medium">Esta ubicación está vacía.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {productsInInfoLocation.map(p => {
                    const boxes = p.locations[infoLocation];
                    const units = boxes * (Number(p.unitsPerBox) || 1);
                    
                    return (
                      <div key={p.id} className="flex gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:shadow-md transition-shadow">
                        {/* Imagen */}
                        <div className="size-16 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center p-1 shrink-0">
                           {p.imageUrl ? <img src={p.imageUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-slate-300">image</span>}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate" title={p.name}>{p.name}</h4>
                          <p className="text-xs text-slate-500 mb-2">{p.sku}</p>
                          
                          <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800 text-center min-w-[60px]">
                              <span className="text-[9px] font-black text-indigo-400 dark:text-indigo-400 block uppercase tracking-wider mb-0.5">Cajas</span>
                              <span className="text-lg font-black text-indigo-700 dark:text-indigo-300 leading-none">{boxes}</span>
                            </div>
                            <div className="text-slate-300 dark:text-slate-600 font-bold text-lg">=</div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800 text-center min-w-[60px]">
                              <span className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 block uppercase tracking-wider mb-0.5">Unidades</span>
                              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 leading-none">{units}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default StockEntry;