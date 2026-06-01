import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Package as PackageIcon, MessageSquare, ShoppingBag, X, Check, Copy } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  currentStock: number;
  minStock?: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
  images?: string[];
  dimensions?: string;
  length?: number;
  width?: number;
  height?: number;
  unitsPerBox?: number;
  sku?: string;
}

interface SharedCartItem {
  product: Product;
  qty: number;
}

interface SharedCartViewProps {
  sharedCart: Record<string, SharedCartItem>;
  onClose: () => void;
  onImport: () => void;
  primaryColor: string;
  selectedBranch: any;
  theme: 'light' | 'dark';
}

export const SharedCartView: React.FC<SharedCartViewProps> = ({
  sharedCart,
  onClose,
  onImport,
  primaryColor,
  selectedBranch,
  theme,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const items = Object.values(sharedCart);
  const totalCount = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.qty * item.product.price, 0);

  // Helper to format quantity in boxes and units
  const formatQuantity = (qty: number, unitsPerBox?: number) => {
    if (unitsPerBox && unitsPerBox > 1) {
      const boxes = Math.floor(qty / unitsPerBox);
      const units = qty % unitsPerBox;
      const parts = [];
      if (boxes > 0) parts.push(`${boxes} ${boxes === 1 ? 'caja' : 'cajas'}`);
      if (units > 0) parts.push(`${units} ${units === 1 ? 'unidad' : 'unidades'}`);
      return {
        text: parts.join(' y '),
        detail: `(${qty} unidades en total)`,
      };
    }
    return {
      text: `${qty} ${qty === 1 ? 'unidad' : 'unidades'}`,
      detail: '',
    };
  };

  // Helper to clean/format WhatsApp number
  const getCleanWhatsAppNumber = (branch: any) => {
    let rawNum = branch?.configuracion?.redes_sociales?.whatsapp || 
                 branch?.configuracion?.contacto?.telefono || 
                 branch?.telefono;
    if (!rawNum) return '';
    
    if (rawNum.includes('wa.me/') || rawNum.includes('phone=')) {
      const match = rawNum.match(/(?:wa\.me\/|phone=)(\d+)/);
      if (match && match[1]) return match[1];
    }
    
    let digits = rawNum.replace(/\D/g, '');
    if (digits.length === 9) {
      digits = '51' + digits; // Peru country code fallback
    }
    return digits;
  };

  // Action: Open WhatsApp chat
  const handleWhatsAppContact = () => {
    let message = `*Consulta sobre selección de catálogo - Dechy Inventario*\n\n`;
    message += `Hola, estoy revisando esta selección de productos de la sucursal *${selectedBranch?.name || 'Decor Haus'}*:\n\n`;
    
    items.forEach(({ product: p, qty }) => {
      const qtyInfo = formatQuantity(qty, p.unitsPerBox);
      message += `• *${p.name}* - ${qtyInfo.text} ${qtyInfo.detail} (S/ ${(p.price * qty).toFixed(2)})\n`;
    });
    
    message += `\n*Total estimado:* S/ ${totalAmount.toFixed(2)}\n\n`;
    message += `Enlace de referencia:\n${window.location.href}`;
    
    const waNumber = getCleanWhatsAppNumber(selectedBranch);
    const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-120px)] max-w-6xl mx-auto px-4 py-8 sm:px-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/50 dark:border-white/5 shadow-md">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: primaryColor }}>
              Vista de Cliente
            </span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Selección Compartida
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-slate-950 dark:text-white leading-tight font-normal">
            Detalle del Pedido
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-light max-w-xl">
            Estás visualizando los productos seleccionados por el cliente desde el catálogo. Puedes importar esta selección a tu carrito activo o contactar con soporte.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <button
            onClick={copyShareLink}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-350 flex items-center gap-1.5 border border-slate-250/70 dark:border-slate-800 ${
              copiedLink 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-200' 
                : 'bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80'
            }`}
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? '¡Enlace copiado!' : 'Copiar enlace'}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            title="Cerrar vista y volver al catálogo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Product List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product: p, qty }) => {
            const qtyInfo = formatQuantity(qty, p.unitsPerBox);
            const imageUrl = p.images?.[0] || p.imageUrl;
            
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Product Image */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 shrink-0 flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <PackageIcon className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                  )}
                </div>

                {/* Product Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {p.category || 'Producto'}
                    </span>
                    {p.brand && (
                      <>
                        <span className="text-slate-350 dark:text-slate-700 text-[8px]">•</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          {p.brand}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {p.name}
                  </h3>
                  
                  {p.dimensions && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      Medidas: {p.dimensions}
                    </p>
                  )}

                  {/* Quantity and box/unit detail */}
                  <div className="pt-1.5 flex flex-wrap items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Cantidad: {qtyInfo.text}
                    </span>
                    {qtyInfo.detail && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-light">
                        {qtyInfo.detail}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pricing Details */}
                <div className="w-full sm:w-auto pt-3 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800/80 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
                  <div className="text-[10px] text-slate-400 font-medium">
                    Precio unitario: S/ {p.price.toFixed(2)}
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    S/ {(p.price * qty).toFixed(2)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right: Checkout Summary Sidepanel */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/50 dark:border-white/5 shadow-md space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Resumen del Pedido
            </h2>
            
            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Productos seleccionados:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{items.length} items</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Unidades totales:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount} unidades</span>
              </div>
              {selectedBranch && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-850 pt-3">
                  <span>Sucursal consultada:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedBranch.name}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-850 pt-4 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-500">Monto total estimado:</span>
              <span className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                S/ {totalAmount.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2.5 pt-4">
              <button
                onClick={onImport}
                className="w-full py-3 rounded-full text-xs font-bold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingBag className="w-4 h-4" />
                Generar Venta
              </button>

              <button
                onClick={handleWhatsAppContact}
                className="w-full py-3 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <MessageSquare className="w-4 h-4" />
                Contactar por WhatsApp
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800/80 transition-all flex items-center justify-center"
              >
                Ver Catálogo Completo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
