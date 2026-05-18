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
}> = ({ product, index, onClick, onAddToCart, cartQty = 0 }) => {
  const isOutOfStock = product.currentStock === 0;
  const allImages = product.images?.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
  const [imgIdx, setImgIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    let iv: NodeJS.Timeout;
    if (hovered && allImages.length > 1) {
      iv = setInterval(() => setImgIdx(p => (p + 1) % allImages.length), 1800);
    }
    return () => clearInterval(iv);
  }, [hovered, allImages.length]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setImgIdx(0); }}
      className="group flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50 overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer relative"
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-slate-50 dark:bg-slate-950" onClick={onClick}>
        {allImages.length > 0 ? (
          <>
            <img
              src={allImages[imgIdx]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading={index < 8 ? undefined : "lazy"}
            />
            {allImages.length > 1 && (
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
      <div className="p-2.5 flex flex-col gap-1 flex-1" onClick={onClick}>
        <h3 className="text-slate-900 dark:text-white text-[11px] font-semibold leading-snug line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-0.5 mt-auto">
          <span className="text-[9px] text-slate-400 font-medium">S/</span>
          <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
            {product.price?.toFixed(2) || '0.00'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400">{product.brand || ''}</span>
          <span className={`text-[9px] font-semibold ${product.currentStock > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
            {product.currentStock > 0 ? `${product.currentStock} disp.` : 'Sin stock'}
          </span>
        </div>
      </div>

      {/* Add to cart button */}
      {onAddToCart && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all shadow-sm"
          title="Agregar a selección"
        >
          {cartQty > 0 ? (
            <span className="text-[10px] font-bold">{cartQty}</span>
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
};
