import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import AppLayout from '../components/layout/AppLayout';
import { collection, doc, onSnapshot, query, updateDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const PAYMENT_METHODS = [
  { id: 'Efectivo', label: 'Efectivo', icon: 'payments', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'Tarjeta', label: 'Tarjeta / POS', icon: 'credit_card', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'Transferencia', label: 'Transferencia', icon: 'account_balance', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'Yape/Plin', label: 'Yape / Plin', icon: 'qr_code_2', color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

const KPISection = ({ metrics }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {PAYMENT_METHODS.map((method) => (
      <div key={method.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
        <div className={`absolute -right-4 -top-4 size-24 ${method.bg} rounded-full blur-2xl opacity-50 group-hover:scale-150 transition-transform duration-700`}></div>
        <div className="relative flex items-center gap-4">
          <div className={`size-12 rounded-xl ${method.bg} ${method.color} flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined text-2xl">{method.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{method.label}</p>
            <p className="text-xl font-black text-slate-900 dark:text-white truncate">S/ {(metrics[method.id] || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SaleDetailContent = ({ 
  sale, 
  onApprove, 
  onReject, 
  onEdit, 
  isProcessing,
  paymentMethod,
  setPaymentMethod,
  amountPaid,
  setAmountPaid,
  paymentReference,
  setPaymentReference
}) => (
  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumen de Productos</h4>
        <div className="space-y-2">
          {sale.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {item.productName} 
                <span className="ml-2 text-[10px] font-bold text-slate-400">
                  x{item.saleMode === 'cajas' ? item.quantitySoldBoxes : item.quantitySoldUnits} {item.saleMode}
                </span>
              </span>
              <span className="font-bold text-slate-900 dark:text-white">S/ {Number(item.subtotal).toFixed(2)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span className="text-sm font-black text-slate-400 uppercase">Subtotal</span>
            <span className="text-lg font-black text-primary">S/ {Number(sale.totalValue).toFixed(2)}</span>
          </div>
        </div>
        <button 
          onClick={onEdit}
          className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          Ajustar Cantidades
        </button>
      </div>

      <div className="flex-1 space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <h4 className="text-xs font-black text-primary uppercase tracking-widest">Registro de Pago</h4>
        
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Método de Pago</label>
            <select 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Yape/Plin">Yape / Plin</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Monto Pagado (S/)</label>
            <input 
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {(paymentMethod === 'Transferencia' || paymentMethod === 'Yape/Plin') && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Referencia / Operación</label>
              <input 
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Opcional"
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>
      </div>
    </div>

    <div className="flex gap-4">
      <button 
        onClick={onReject}
        disabled={isProcessing}
        className="flex-1 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-900/10 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-lg">cancel</span>
        Rechazar Venta
      </button>
      <button 
        onClick={onApprove}
        disabled={isProcessing}
        className="flex-[2] py-4 rounded-2xl bg-slate-900 dark:bg-primary text-white font-black text-xs uppercase tracking-widest hover:opacity-90 dark:hover:opacity-100 dark:hover:brightness-110 transition-all shadow-xl shadow-slate-900/10 dark:shadow-primary/20 flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
        ) : (
          <>
            <span className="material-symbols-outlined text-lg">check_circle</span>
            Confirmar y Cobrar
          </>
        )}
      </button>
    </div>
  </div>
);

const Cashier = () => {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // States for editing quantities
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItems, setEditingItems] = useState([]);
  const [editingSale, setEditingSale] = useState(null);

  // States for payment recording
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState({});

  useEffect(() => {
    if (!currentBranch) return;

    // Fetch ALL sales for today to calculate KPIs
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'sales'),
      where('branchId', '==', currentBranch.id),
      where('status', 'in', ['pending_delivery', 'completed', 'paid']),
      where('paymentDate', '>=', today)
    );

    const unsub = onSnapshot(q, (snap) => {
      const metrics = { 'Efectivo': 0, 'Tarjeta': 0, 'Transferencia': 0, 'Yape/Plin': 0 };
      snap.forEach(doc => {
        const data = doc.data();
        const method = data.paymentMethod || 'Efectivo';
        metrics[method] = (metrics[method] || 0) + (Number(data.amountPaid) || Number(data.totalValue) || 0);
      });
      setDailyMetrics(metrics);
    });

    return () => unsub();
  }, [currentBranch]);

  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);

    const q = query(
      collection(db, 'sales'),
      where('branchId', '==', currentBranch.id),
      where('status', '==', 'pending_payment'),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setSales(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tickets:", error);
      toast.error("Error al cargar los tickets de venta.");
      setLoading(false);
    });
    return () => unsub();
  }, [currentBranch]);

  const handleApprove = async (sale) => {
    if (!amountPaid || Number(amountPaid) <= 0) {
      toast.error("Por favor ingrese un monto válido.");
      return;
    }
    
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'pending_delivery',
        paymentDate: new Date(),
        paymentMethod,
        amountPaid: Number(amountPaid),
        paymentReference: paymentReference || ''
      });
      toast.success('Venta aprobada y pagada.');
      setExpandedSaleId(null);
      resetPaymentFields();
    } catch (error) {
      console.error("Error approving sale:", error);
      toast.error("Error al aprobar la venta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPaymentFields = () => {
    setPaymentMethod('Efectivo');
    setAmountPaid('');
    setPaymentReference('');
  };

  const handleReject = async (sale) => {
    if (!window.confirm('¿Está seguro de rechazar esta venta?')) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'cancelled'
      });
      toast.success('Venta rechazada.');
      setExpandedSaleId(null);
    } catch (error) {
      console.error("Error rejecting sale:", error);
      toast.error("Error al rechazar la venta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditModal = (sale) => {
    setEditingSale(sale);
    setEditingItems(JSON.parse(JSON.stringify(sale.items))); // Deep copy
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    const totalValue = editingItems.reduce((sum, item) => sum + item.subtotal, 0);
    try {
      await updateDoc(doc(db, 'sales', editingSale.id), {
        items: editingItems,
        totalValue: totalValue
      });
      toast.success('Venta actualizada.');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating sale:", error);
      toast.error("Error al actualizar la venta.");
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sales, searchTerm]);

  const toggleExpand = (sale) => {
    if (expandedSaleId === sale.id) {
      setExpandedSaleId(null);
      resetPaymentFields();
    } else {
      setExpandedSaleId(sale.id);
      setAmountPaid(sale.totalValue.toString());
      resetPaymentFields(); // Clear previous inputs but set amount to total
      setAmountPaid(sale.totalValue.toString());
    }
  };

  const updateItemQty = (index, field, value) => {
    const val = Number(value) || 0;
    const newItems = [...editingItems];
    const item = newItems[index];
    
    if (field === 'quantitySoldBoxes') {
      item.quantitySoldBoxes = val;
    } else if (field === 'quantitySoldUnits') {
      item.quantitySoldUnits = val;
    }

    // Recalculate subtotal (simplified common logic, ideally would use calcSale helper)
    const upb = Number(item.unitsPerBox) || 1;
    const boxes = item.quantitySoldBoxes;
    const units = item.quantitySoldUnits;
    
    // Check for wholesale pricing if applicable
    const wPrice = Number(item.wholesalePrice) || 0;
    const wThreshold = Number(item.wholesaleThreshold) || 0;
    const wUnit = item.wholesaleThresholdUnit || 'cajas';
    
    let currentQty = item.saleMode === 'cajas' ? boxes : units;
    let isWholesale = false;
    if (wPrice > 0 && wThreshold > 0) {
      const currentQtyInThresholdUnit = item.saleMode === wUnit ? currentQty : (item.saleMode === 'cajas' ? currentQty * upb : currentQty / upb);
      if (currentQtyInThresholdUnit >= wThreshold) isWholesale = true;
    }

    const activeUnitPrice = isWholesale ? wPrice : (Number(item.unitPrice) || 0);
    const activeBoxPrice = isWholesale ? (wPrice * upb) : (Number(item.boxPrice) || 0);

    if (item.saleMode === 'cajas') {
      item.subtotal = boxes * activeBoxPrice;
    } else {
      const fullBoxes = Math.floor(units / upb);
      const remainder = units % upb;
      item.subtotal = (fullBoxes * activeBoxPrice) + (remainder * activeUnitPrice);
      item.fullBoxes = fullBoxes;
      item.remainderUnits = remainder;
    }
    
    setEditingItems(newItems);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Caja / Cobros</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Aprobación de tickets y recepción de pagos</p>
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

          <KPISection metrics={dailyMetrics} />

          {loading ? (
            <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-10">
              <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-4 rounded-full">receipt</span>
              <p className="font-bold text-lg text-slate-700 dark:text-slate-300">No hay tickets coincidentes</p>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">Intente con otro número de ticket o espere nuevos registros</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="flex flex-col gap-3">
                  <div 
                    onClick={() => toggleExpand(sale)} 
                    className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all p-6 cursor-pointer group ${expandedSaleId === sale.id ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`size-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${expandedSaleId === sale.id ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                        <span className="material-symbols-outlined">{expandedSaleId === sale.id ? 'expand_less' : 'receipt_long'}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Total</p>
                        <p className="text-xl font-black text-primary leading-tight">S/ {Number(sale.totalValue).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Ticket</p>
                      <p className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">{sale.ticketNumber || 'S/N'}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Vendedor</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">{sale.userName || sale.sellerName || 'Desconocido'}</p>
                      </div>
                      <span className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                    </div>
                  </div>
                  {expandedSaleId === sale.id && (
                    <div className="animate-in slide-in-from-top-4 duration-300">
                      <SaleDetailContent 
                        sale={sale} 
                        onApprove={() => handleApprove(sale)}
                        onReject={() => handleReject(sale)}
                        onEdit={() => openEditModal(sale)}
                        isProcessing={isProcessing}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        amountPaid={amountPaid}
                        setAmountPaid={setAmountPaid}
                        paymentReference={paymentReference}
                        setPaymentReference={setPaymentReference}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr 
                          onClick={() => toggleExpand(sale)}
                          className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${expandedSaleId === sale.id ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900 dark:text-white uppercase text-sm">{sale.ticketNumber || 'S/N'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{sale.userName || sale.sellerName || 'Desconocido'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-500 font-medium">{sale.date?.toDate().toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-black text-primary">S/ {Number(sale.totalValue).toFixed(2)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr>
                            <td colSpan="5" className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-y border-slate-100 dark:border-slate-800">
                              <div className="animate-in slide-in-from-top-2 duration-200">
                                <SaleDetailContent 
                                  sale={sale} 
                                  onApprove={() => handleApprove(sale)}
                                  onReject={() => handleReject(sale)}
                                  onEdit={() => openEditModal(sale)}
                                  isProcessing={isProcessing}
                                  paymentMethod={paymentMethod}
                                  setPaymentMethod={setPaymentMethod}
                                  amountPaid={amountPaid}
                                  setAmountPaid={setAmountPaid}
                                  paymentReference={paymentReference}
                                  setPaymentReference={setPaymentReference}
                                />
                              </div>
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
      </div>

      {/* Edit Quantities Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Ajustar Cantidades</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editingItems.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.productName}</p>
                    <p className="text-sm font-black text-primary">S/ {item.subtotal.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.saleMode === 'cajas' ? 'Cajas' : 'Unidades'}</p>
                    <input 
                      type="number" 
                      value={item.saleMode === 'cajas' ? item.quantitySoldBoxes : item.quantitySoldUnits}
                      onChange={(e) => updateItemQty(idx, item.saleMode === 'cajas' ? 'quantitySoldBoxes' : 'quantitySoldUnits', e.target.value)}
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex-1 py-4 bg-slate-900 dark:bg-primary text-white font-black text-xs uppercase tracking-widest hover:opacity-90 dark:hover:opacity-100 dark:hover:brightness-110 transition-all shadow-lg rounded-xl">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Cashier;
