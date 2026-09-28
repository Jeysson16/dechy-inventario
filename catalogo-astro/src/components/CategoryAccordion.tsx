import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, SlidersHorizontal, X } from 'lucide-react';

export interface CategoryWithSubcategories {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

interface CategoryAccordionProps {
  categories: CategoryWithSubcategories[];
  selectedCategory: string;
  selectedSubcategory: string | null;
  onSelectCategory: (cat: string) => void;
  onSelectSubcategory: (parentName: string, subId: string | null) => void;
  primaryColor: string;
  resultCount: number;
}

const AccordionItem: React.FC<{
  cat: CategoryWithSubcategories;
  isActive: boolean;
  isOpen: boolean;
  isSubActive: (id: string) => boolean;
  onSelectCategory: (cat: string) => void;
  onSelectSubcategory: (parentName: string, subId: string | null) => void;
  primaryColor: string;
}> = ({ cat, isActive, isOpen, isSubActive, onSelectCategory, onSelectSubcategory, primaryColor }) => {
  return (
    <div className="border-b border-slate-200/80 dark:border-slate-800/60">
      <button
        onClick={() => onSelectCategory(cat.name)}
        className="w-full flex items-center justify-between py-4 group text-left"
      >
        <span
          className="text-[15px] capitalize transition-all duration-300 group-hover:translate-x-1 text-slate-800 dark:text-slate-200"
          style={{ color: isActive ? primaryColor : undefined }}
        >
          {cat.name}
        </span>
        {cat.subcategories.length > 0 && (
          <span className="text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" style={{ color: isActive ? primaryColor : undefined }}>
            {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && cat.subcategories.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 pb-4 pl-3">
              {cat.subcategories.map(sub => {
                const active = isSubActive(sub.id) || isSubActive(sub.name);
                return (
                  <button
                    key={sub.id}
                    onClick={() => onSelectSubcategory(cat.name, active ? null : sub.id)}
                    className="text-left text-[14px] text-slate-700 dark:text-slate-300 transition-all duration-300 hover:translate-x-1 hover:text-slate-950 dark:hover:text-white"
                    style={{ color: active ? primaryColor : undefined }}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  categories, selectedCategory, selectedSubcategory, onSelectCategory, onSelectSubcategory, primaryColor, resultCount
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Only one parent category can be expanded at a time — opening a new one
  // (or selecting it) automatically collapses whichever was open before.
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(
    () => categories.find(c => c.name === selectedCategory && c.subcategories.length > 0)?.id || null
  );

  const isSubActive = (idOrName: string) => selectedSubcategory === idOrName;

  // Single source of truth for both the filter selection and which accordion
  // item is expanded — selecting a parent opens it and collapses whichever
  // other one was open; clicking the already-open one again collapses it.
  const handleSelectCategory = (catName: string) => {
    onSelectCategory(catName);
    if (catName === 'Todos') {
      setOpenCategoryId(null);
      return;
    }
    const cat = categories.find(c => c.name === catName);
    if (!cat || cat.subcategories.length === 0) {
      setOpenCategoryId(null);
      return;
    }
    setOpenCategoryId(prev => (prev === cat.id ? null : cat.id));
  };

  const body = (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] px-5 pt-6 pb-2">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <span className="text-[18px] font-extrabold uppercase tracking-tight text-slate-900 dark:text-white">Categorías</span>
        <span className="text-[11px] font-semibold text-slate-400">{resultCount}</span>
      </div>
      <button
        onClick={() => handleSelectCategory('Todos')}
        className="w-full flex items-center justify-between py-4 border-b border-slate-200/80 dark:border-slate-800/60 text-left group"
      >
        <span
          className="text-[15px] transition-all duration-300 group-hover:translate-x-1 text-slate-800 dark:text-slate-200"
          style={{ color: selectedCategory === 'Todos' ? primaryColor : undefined }}
        >
          Todos los productos
        </span>
      </button>
      {categories.map(cat => (
        <AccordionItem
          key={cat.id}
          cat={cat}
          isActive={selectedCategory === cat.name}
          isOpen={openCategoryId === cat.id}
          isSubActive={isSubActive}
          onSelectCategory={handleSelectCategory}
          onSelectSubcategory={onSelectSubcategory}
          primaryColor={primaryColor}
        />
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filtrar por categoría
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:sticky lg:top-28 h-max">{body}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute left-0 top-0 h-full w-full max-w-xs bg-slate-50 dark:bg-[#09090b] shadow-2xl p-4 overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtros</span>
                <button onClick={() => setMobileOpen(false)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
              </div>
              {body}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
