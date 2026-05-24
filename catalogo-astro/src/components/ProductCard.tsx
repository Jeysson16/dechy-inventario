import React, { useState, useEffect } from 'react';
import { Package, Plus } from 'lucide-react';

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
}

export const ProductCard: React.FC<{
  product: Product;
  index: number;
  onClick?: () => void;
  onAddToCart?: (product: Product) => void;
  cartQty?: number;
  primaryColor?: string;
}> = ({ product, index, onClick, onAddToCart, cartQty = 0, primaryColor }) => {
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
        
        {/* Specs / category label */}
        <span className="text-[10px] text-slate-400 font-light mt-0.5 block">
          {product.category || 'Revestimiento'}
        </span>

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

          {onAddToCart && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                cartQty > 0 
                  ? 'text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
              style={cartQty > 0 ? { backgroundColor: primaryColor || '#0f172a' } : {}}
              onMouseEnter={(e) => {
                if (cartQty === 0 && primaryColor) {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (cartQty === 0) {
                  e.currentTarget.style.backgroundColor = '';
                  e.currentTarget.style.color = '';
                }
              }}
              title="Agregar a selección"
            >
              {cartQty > 0 ? (
                <span className="text-[10px] font-bold">{cartQty}</span>
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
