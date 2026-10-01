import React from 'react';

// Availability only — the catalog never exposes how many units are left
export const StockBadge: React.FC<{ inStock: boolean; className?: string }> = ({ inStock, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[10px] font-bold leading-none text-white whitespace-nowrap ${inStock ? 'bg-emerald-500' : 'bg-rose-500'} ${className}`}
  >
    {inStock ? 'En stock' : 'Sin stock'}
  </span>
);
