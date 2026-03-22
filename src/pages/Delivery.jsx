import { collection, doc, onSnapshot, query, updateDoc, where, orderBy } from 'firebase/firestore';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/layout/AppLayout';
import LayoutPreview from '../components/inventory/LayoutPreview';

/* --- Helper: Draggable Container for Croquis --- */
const DraggableContainer = ({ children }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const onMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const onMouseUp = () => setIsDragging(false);
  const onMouseLeave = () => setIsDragging(false);

  const onMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 2;
    const walkY = (y - startY) * 2;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  return (
    <div 
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      className={`w-full h-full overflow-auto cursor-${isDragging ? 'grabbing' : 'grab'} selection-none select-none scrollbar-hide`}
      style={{ scrollBehavior: 'auto' }}
    >
      <div className="min-w-fit min-h-fit p-20">
        {children}
      </div>
    </div>
  );
};

/* --- Delivery Detail Content --- */
const DeliveryDetailContent = ({ sale, handleComplete, setViewingLayoutItem, isUpdating }) => (
  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-8 shadow-inner animate-in slide-in-from-top-4 duration-300">
    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
      <div className="flex-1">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Guía de Recolección</h4>
        <div className="grid grid-cols-1 gap-4">
          {sale.items?.map((item, idx) => (
            <div key={idx} className="group p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/40 hover:shadow-lg transition-all duration-300">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1">
                  <p className="font-black text-slate-800 dark:text-slate-100 uppercase text-sm mb-1">{item.productName}</p>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                       {item.saleMode === 'cajas' ? `${item.quantitySoldBoxes} CAJAS` : `${item.quantitySoldUnits} UNIDADES`}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingLayoutItem(item); }}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary transition-colors shadow-lg shadow-slate-900/10"
                >
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  Ubicación
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full md:w-80 space-y-6">
        <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-600/20">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2 text-center">Finalizar Entrega</p>
          <button 
            onClick={handleComplete}
            disabled={isUpdating}
            className="w-full py-4 rounded-2xl bg-white text-emerald-700 font-black text-xs uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
          >
            {isUpdating ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Confirmar Todo
              </>
            )}
          </button>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendedor</p>
          <p className="font-bold text-slate-800 dark:text-slate-200">{sale.userName || sale.sellerName || 'Desconocido'}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest opacity-70 italic">{sale.date?.toDate().toLocaleString()}</p>
        </div>
      </div>
    </div>
  </div>
);

/* --- Delivery View --- */
const Delivery = () => {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [viewingLayoutItem, setViewingLayoutItem] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch branch layouts for croquis
  useEffect(() => {
    if (!currentBranch) return;
    const branchDocRef = doc(db, 'branches', currentBranch.id);
    const unsub = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let loadedLayouts = [];
        if (data.layouts && Array.isArray(data.layouts)) {
          loadedLayouts = data.layouts;
        } else if (data.layout) {
          loadedLayouts = [{ id: 'main', name: 'Principal', ...data.layout }];
        }
        setBranchLayouts(loadedLayouts);
      }
    });
    return () => unsub();
  }, [currentBranch]);

  // Fetch pending delivery sales
  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);

    const q = query(
      collection(db, 'sales'),
      where('branchId', '==', currentBranch.id),
      where('status', '==', 'pending_delivery'),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setSales(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching delivery queue:", error);
      toast.error("Error al cargar cola de despacho.");
      setLoading(false);
    });
    return () => unsub();
  }, [currentBranch]);

  const handleCompleteDelivery = async (sale) => {
    if (!window.confirm('¿Confirmar que todos los productos han sido entregados al cliente?')) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'completed',
        deliveredAt: new Date()
      });
      toast.success('Venta despachada con éxito.');
      setExpandedSaleId(null);
    } catch (error) {
      console.error("Error completing delivery:", error);
      toast.error("Error al procesar el despacho.");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sales, searchTerm]);

  const toggleExpand = (sale) => {
    setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id);
  };

  if (viewingLayoutItem) {
    const activeLayout = branchLayouts.find(l => 
      Object.keys(viewingLayoutItem.locations || {}).some(k => k.startsWith(`${l.id}__`))
    ) || branchLayouts[0];
    
    const quantities = {};
    if (activeLayout) {
      Object.entries(viewingLayoutItem.locations || {}).forEach(([key, qty]) => {
        if (key.startsWith(`${activeLayout.id}__`)) {
          quantities[key.replace(`${activeLayout.id}__`, '')] = qty;
        } else if (!key.includes('__') && (activeLayout.id === 'main' || activeLayout.id === 'default')) {
          quantities[key] = qty;
        }
      });
    }

    return (
      <AppLayout>
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setViewingLayoutItem(null)} 
                className="size-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <h3 className="font-bold text-white leading-tight">Ubicación: {viewingLayoutItem.productName}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">MAPA DE ANAQUELES - {activeLayout?.name || 'VISTA GENERAL'}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800/50 via-slate-900 to-slate-950">
            {activeLayout ? (
              <DraggableContainer>
                <LayoutPreview layout={activeLayout} quantities={quantities} readOnly={true} />
              </DraggableContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                <span className="material-symbols-outlined text-6xl">map</span>
                <p className="font-bold uppercase tracking-widest text-xs">Croquis no configurado para esta sucursal</p>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Almacén</span>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{sales.length} Pendientes</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Cola de Despacho</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">Gestión de entregas y ubicación de productos</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group flex-1 md:w-64">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                <input 
                  type="text" 
                  placeholder="Buscar por Ticket..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>
              
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="material-symbols-outlined">grid_view</span>
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  <span className="material-symbols-outlined">view_list</span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm p-10 text-center">
              <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-6 rounded-full text-slate-300">local_shipping</span>
              <p className="font-bold text-lg text-slate-700 dark:text-slate-300">No hay tickets coincidentes</p>
              <p className="text-sm mt-1">Intente con otro número o verifique el estado del almacén</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="flex flex-col gap-3">
                  <div 
                    onClick={() => toggleExpand(sale)} 
                    className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 p-6 cursor-pointer group flex flex-col h-full ${expandedSaleId === sale.id ? 'border-primary shadow-xl ring-2 ring-primary/5 translate-y-[-4px]' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className={`size-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${expandedSaleId === sale.id ? 'bg-primary text-white' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-primary group-hover:text-white'}`}>
                        <span className="material-symbols-outlined text-3xl">{expandedSaleId === sale.id ? 'expand_less' : 'package_2'}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Ticket</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">#{sale.ticketNumber || 'S/N'}</p>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="mb-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Vendedor</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight truncate">{sale.userName || sale.sellerName || 'Desconocido'}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex gap-2">
                           <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{sale.items?.length} Items</span>
                        </div>
                        <span className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? 'rotate-180 text-primary' : 'group-hover:text-primary group-hover:translate-x-1'}`}>expand_more</span>
                      </div>
                    </div>
                  </div>
                  {expandedSaleId === sale.id && (
                    <DeliveryDetailContent 
                      sale={sale} 
                      handleComplete={() => handleCompleteDelivery(sale)}
                      setViewingLayoutItem={setViewingLayoutItem}
                      isUpdating={isUpdating}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr 
                          onClick={() => toggleExpand(sale)}
                          className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all ${expandedSaleId === sale.id ? 'bg-primary/5 dark:bg-primary/10 shadow-inner' : ''}`}
                        >
                          <td className="px-8 py-6">
                            <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">#{sale.ticketNumber || 'S/N'}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{sale.userName || sale.sellerName || 'Desconocido'}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-xs font-black bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full w-fit">{sale.items?.length} PRODUCTOS</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-3 transition-transform group-hover:scale-105">
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary">Ver Detalles</span>
                               <span className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                             </div>
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr>
                            <td colSpan="4" className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800">
                              <DeliveryDetailContent 
                                sale={sale} 
                                handleComplete={() => handleCompleteDelivery(sale)}
                                setViewingLayoutItem={setViewingLayoutItem}
                                isUpdating={isUpdating}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Detail section is now inline expandable */}
      </div>
    </AppLayout>
  );
};

export default Delivery;
