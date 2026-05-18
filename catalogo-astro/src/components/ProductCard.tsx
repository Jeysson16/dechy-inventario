import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  currentStock: number;
  minStock: number;
  imageUrl?: string;
  images?: string[]; // Array of images
}

export const ProductCard: React.FC<{ product: Product; index: number; onClick?: () => void }> = ({ product, index, onClick }) => {
  const isLowStock = product.currentStock > 0 && product.currentStock <= (product.minStock || 10);
  const isOutOfStock = product.currentStock === 0;

  // Aggregate images
  const allImages = product.images?.length ? product.images : (product.imageUrl ? [product.imageUrl] : []);
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isHovered && allImages.length > 1) {
      interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
      }, 1500); // cycle every 1.5 seconds on hover
    }
    return () => clearInterval(interval);
  }, [isHovered, allImages.length]);

  return (
    <motion.div
      layoutId={`product-${product.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCurrentImageIndex(0);
      }}
      onClick={onClick}
      className="group flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-2 relative cursor-pointer"
      style={{ perspective: '1000px' }}
    >
      {/* Badges Overlay */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap gap-2 pointer-events-none">
        <span
          className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md shadow-sm border ${
            !isOutOfStock && !isLowStock
              ? 'bg-emerald-500/90 text-white border-emerald-400'
              : isLowStock
              ? 'bg-amber-500/90 text-white border-amber-400'
              : 'bg-rose-500/90 text-white border-rose-400'
          }`}
        >
          {isOutOfStock ? 'Agotado' : isLowStock ? 'Stock Bajo' : 'Disponible'}
        </span>
        {allImages.length > 1 && (
          <span className="text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md shadow-sm border bg-blue-500/90 text-white border-blue-400">
            {allImages.length} Imágenes
          </span>
        )}
      </div>

      {/* Image Gallery (3D Card style on hover) */}
      <div className="relative w-full aspect-square overflow-hidden bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-10"></div>
        
        {allImages.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={allImages[currentImageIndex]}
              alt={`${product.name} - Imagen ${currentImageIndex + 1}`}
              initial={{ opacity: 0, rotateY: 90, scale: 0.8 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: -90, scale: 0.8 }}
              transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
              className="absolute w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
              loading={index < 6 ? undefined : "lazy"}
              fetchpriority={index < 6 ? "high" : "auto"}
            />
          </AnimatePresence>
        ) : (
          <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
            <Package className="w-12 h-12" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col gap-4 flex-1">
        <div className="space-y-1">
          <span className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg">
            {product.category || 'Sin Categoría'}
          </span>
          <h3 className="text-slate-900 dark:text-white text-lg font-black leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mt-3">
            {product.name}
          </h3>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-1">
            {product.brand || 'Marca Genérica'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">
              Precio
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-slate-400">S/</span>
              <span className="text-slate-900 dark:text-white font-black text-xl tracking-tighter">
                {product.price?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">
              Stock Total
            </span>
            <div className="flex items-baseline justify-end gap-1">
              <span
                className={`font-black text-xl tracking-tighter ${
                  product.currentStock > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'
                }`}
              >
                {product.currentStock || 0}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Und
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
