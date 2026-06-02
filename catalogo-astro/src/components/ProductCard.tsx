import React, { useState, useEffect } from 'react';
import { Package, Plus, Minus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  currentStock: number;
  minStock: number;
  imageUrl?: string;
  images?: string[];
  unitsPerBox?: number;
}

export const ProductCard: React.FC<{
  product: Product;
  index: number;
  onClick?: () => void;
  onAddToCart?: (product: Product) => void;
  onUpdateCartQty?: (id: string, qty: number, product: Product) => void;
  cartQty?: number;
  primaryColor?: string;
}> = ({ product, index, onClick, onAddToCart, onUpdateCartQty, cartQty = 0, primaryColor }) => {
  const isOutOfStock = product.currentStock === 0;
  const allImages = product.images?.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
  const [imgIdx, setImgIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let iv: NodeJS.Timeout;
    if (hovered && allImages.length > 1) {
      iv = setInterval(() => setImgIdx(p => (p + 1) % allImages.length), 1800);
    }
    return () => clearInterval(iv);
  }, [hovered, allImages.length]);

  // Reset isLoaded when the active image index changes
  useEffect(() => {
    setIsLoaded(false);
  }, [imgIdx]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setImgIdx(0); }}
      className="group flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50 overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer relative"
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-950" onClick={onClick}>
        {allImages.length > 0 ? (
          <>
            {/* Shimmer skeleton placeholder */}
            {!isLoaded && (
              <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-300 dark:text-slate-700" />
              </div>
            )}
            <img
              src={allImages[imgIdx]}
              alt={product.name}
              onLoad={() => setIsLoaded(true)}
              className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading={index < 8 ? "eager" : "lazy"}
              decoding="async"
            />
            {allImages.length > 1 && isLoaded && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, i) => (
                  <span key={i} className={`w-1 h-1 rounded-full transition-all ${i === imgIdx ? 'bg-white w-3' : 'bg-white/50'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
            <Package className="w-10 h-10" />
          </div>
        )}
        {isOutOfStock && (
          <span className="absolute top-2 left-2 text-[8px] font-bold px-2 py-0.5 rounded bg-rose-500 text-white uppercase">Agotado</span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5 flex-1" onClick={onClick}>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">
          {product.brand || product.category || 'Dechy'}
        </span>
        <h3 className="text-slate-900 dark:text-white text-[12px] font-bold leading-snug line-clamp-2 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
          {product.name}
        </h3>

        {/* Pricing and Cart Actions */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100/60 dark:border-slate-800/40">
          <div className="flex flex-col">
            <span className={`text-[9px] font-semibold mb-0.5 ${product.currentStock > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
              {product.currentStock > 0 ? `${product.currentStock} disp.` : 'Sin stock'}
            </span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[9px] text-slate-400 font-medium">S/</span>
              <span className="text-[13px] sm:text-[14px] font-extrabold text-slate-900 dark:text-white tracking-tight">
                {product.price?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAddToCart && (
            cartQty > 0 ? (
              <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                {product.unitsPerBox && product.unitsPerBox > 1 ? (
                  /* Box and unit dual steppers */
                  <div className="flex flex-col gap-1">
                    {/* Cajas */}
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase w-6 text-right">Cjs</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateCartQty?.(product.id, cartQty - product.unitsPerBox, product); }} 
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <input 
                        value={Math.floor(cartQty / product.unitsPerBox)}
                        onChange={e => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const remainder = cartQty % product.unitsPerBox;
                          onUpdateCartQty?.(product.id, val * product.unitsPerBox + remainder, product);
                        }}
                        className="w-7 text-center bg-transparent border-none text-[10px] font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateCartQty?.(product.id, cartQty + product.unitsPerBox, product); }} 
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    {/* Unidades */}
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase w-6 text-right">Uni</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateCartQty?.(product.id, cartQty - 1, product); }} 
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <input 
                        min="0"
                        value={cartQty % product.unitsPerBox}
                        onChange={e => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const boxes = Math.floor(cartQty / product.unitsPerBox);
                          onUpdateCartQty?.(product.id, boxes * product.unitsPerBox + val, product);
                        }}
                        className="w-7 text-center bg-transparent border-none text-[10px] font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateCartQty?.(product.id, cartQty + 1, product); }} 
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard unit stepper */
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg p-0.5 border border-slate-200/50 dark:border-white/5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUpdateCartQty?.(product.id, cartQty - 1, product); }} 
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-350 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input 
                      min="0"
                      value={cartQty}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        onUpdateCartQty?.(product.id, val, product);
                      }}
                      className="w-8 text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUpdateCartQty?.(product.id, cartQty + 1, product); }} 
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-350 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Normal Add Button */
              <button
                onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-305 hover:opacity-90"
                onMouseEnter={(e) => {
                  if (primaryColor) {
                    e.currentTarget.style.backgroundColor = primaryColor;
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                  e.currentTarget.style.color = '';
                }}
                title="Agregar a selección"
              >
                <Plus className="w-4 h-4" />
              </button>
            )
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
