import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Minus, ShoppingBag } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand: string;
  price: number;
  currentStock: number;
  minStock: number;
  imageUrl?: string;
  images?: string[];
  unitsPerBox?: number;
  createdAt?: any;
}

const NEW_PRODUCT_DAYS = 30;

// createdAt may be a Firestore Timestamp, a serialized {seconds}, a Date or an ISO string
const toMillis = (value: any): number | null => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

const isNewProduct = (product: Product) => {
  const created = toMillis(product.createdAt);
  return created !== null && Date.now() - created < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;
};

const stepBtn = 'flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors';

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
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    if (hovered && allImages.length > 1) {
      iv = setInterval(() => setImgIdx(p => (p + 1) % allImages.length), 1800);
    }
    return () => clearInterval(iv);
  }, [hovered, allImages.length]);

  // Reset isLoaded when the active image index changes
  useEffect(() => {
    setIsLoaded(false);
  }, [imgIdx]);

  // Subtle 3D tilt that follows the cursor across the card
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${(x * 5).toFixed(2)}deg`);
    el.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setImgIdx(0);
    cardRef.current?.style.setProperty('--tilt-x', '0deg');
    cardRef.current?.style.setProperty('--tilt-y', '0deg');
  };

  const label = product.subcategory || product.category || product.brand || '';

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="product-card group relative h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl overflow-hidden cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      {/* Cursor-following soft light */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(255,255,255,0.35), transparent 55%)' }}
      />

      {/* Badges */}
      <div className="absolute top-3 left-3 z-20 flex gap-1.5">
        {isNewProduct(product) && (
          <span className="px-2.5 py-[3px] rounded-full border-[1.5px] border-[#1f2a4d] dark:border-slate-300 text-[#1f2a4d] dark:text-slate-200 bg-white/90 dark:bg-slate-900/90 text-[10px] font-bold leading-none">Nuevo</span>
        )}
        {isOutOfStock && (
          <span className="px-2.5 py-[3px] rounded-full border-[1.5px] border-rose-500 text-rose-500 bg-white/90 dark:bg-slate-900/90 text-[10px] font-bold leading-none">Agotado</span>
        )}
      </div>

      {/* Image — zooms on hover but stays clipped inside the card */}
      <div className="relative w-full aspect-square overflow-hidden bg-white dark:bg-slate-900">
        {allImages.length > 0 ? (
          <>
            {!isLoaded && (
              <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-300 dark:text-slate-700" />
              </div>
            )}
            <img
              src={allImages[imgIdx]}
              alt={product.name}
              onLoad={() => setIsLoaded(true)}
              className={`w-full h-full object-contain p-6 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.12] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading={index < 8 ? 'eager' : 'lazy'}
              decoding="async"
            />
            {allImages.length > 1 && isLoaded && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {allImages.map((_, i) => (
                  <span key={i} className={`h-1 rounded-full transition-all ${i === imgIdx ? 'bg-slate-700 w-3' : 'bg-slate-300 w-1'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
            <Package className="w-10 h-10" />
          </div>
        )}
      </div>

      {/* Content — category label gives way to the add button on hover */}
      <div className="px-4 pb-5 pt-1 flex flex-col items-center text-center gap-1">
        <div className="relative h-5 w-full overflow-hidden">
          <span className="product-card-label absolute inset-0 text-[13px] text-slate-500 dark:text-slate-400 truncate capitalize transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
            {label}
          </span>
          {onAddToCart && cartQty === 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
              className="product-card-add absolute inset-0 mx-auto w-fit flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:underline"
              style={{ color: primaryColor || '#0f172a' }}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Agregar
            </button>
          )}
        </div>
        <h3 className="text-[16px] text-slate-900 dark:text-white leading-snug line-clamp-2 transition-colors">
          {product.name}
        </h3>
        <span className="text-[12px] text-slate-400 font-medium">
          S/ {product.price?.toFixed(2) || '0.00'}
        </span>

        {/* Quantity steppers once the product is in the selection */}
        {onUpdateCartQty && cartQty > 0 && (
          <div className="mt-2 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
            {product.unitsPerBox && product.unitsPerBox > 1 ? (
              <>
                {[
                  { label: 'Cjs', value: Math.floor(cartQty / product.unitsPerBox), step: product.unitsPerBox, set: (v: number) => cartQty % product.unitsPerBox! + v * product.unitsPerBox! },
                  { label: 'Uni', value: cartQty % product.unitsPerBox, step: 1, set: (v: number) => Math.floor(cartQty / product.unitsPerBox!) * product.unitsPerBox! + v },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase w-6 text-right">{row.label}</span>
                    <button onClick={() => onUpdateCartQty(product.id, cartQty - row.step, product)} className={`${stepBtn} w-5 h-5 hover:bg-rose-100 hover:text-rose-500`}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      value={row.value}
                      onChange={e => onUpdateCartQty(product.id, row.set(Math.max(0, parseInt(e.target.value) || 0)), product)}
                      className="w-8 text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                    />
                    <button onClick={() => onUpdateCartQty(product.id, cartQty + row.step, product)} className={`${stepBtn} w-5 h-5 hover:bg-emerald-100 hover:text-emerald-500`}>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-full p-0.5">
                <button onClick={() => onUpdateCartQty(product.id, cartQty - 1, product)} className={`${stepBtn} w-6 h-6 bg-white dark:bg-slate-700 hover:bg-rose-100 hover:text-rose-500`}>
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  value={cartQty}
                  onChange={e => onUpdateCartQty(product.id, Math.max(0, parseInt(e.target.value) || 0), product)}
                  className="w-9 text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                />
                <button onClick={() => onUpdateCartQty(product.id, cartQty + 1, product)} className={`${stepBtn} w-6 h-6 bg-white dark:bg-slate-700 hover:bg-emerald-100 hover:text-emerald-500`}>
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
