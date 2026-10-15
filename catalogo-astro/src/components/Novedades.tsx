import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

export interface NewsItem {
  id: string;
  imageUrl: string;
  name: string;
  available: boolean;
}

interface NovedadesProps {
  items: NewsItem[] | null; // null while products load
  primaryColor: string;
  bannerImage?: string;
  onGoToCatalog: () => void;
}

const toMillis = (ts: any) => (ts?.toMillis ? ts.toMillis() : ts ? new Date(ts).getTime() : 0);

// Upcoming arrivals are products the inventory flags with newsStatus ("proximamente" |
// "disponible"); newsHidden takes one out of this tab. Only photo and name are shown.
export const toNewsItems = (products: any[]): NewsItem[] =>
  products
    .filter(p => (p.newsStatus === 'proximamente' || p.newsStatus === 'disponible') && !p.newsHidden)
    .sort((a, b) => toMillis(b.newsAddedAt || b.createdAt) - toMillis(a.newsAddedAt || a.createdAt))
    .map(p => ({
      id: p.id,
      imageUrl: p.mainImageUrl || p.imageUrl || p.imageUrls?.[0]?.url || p.images?.[0] || '',
      name: p.name || '',
      available: p.newsStatus === 'disponible',
    }))
    .filter(n => n.imageUrl);

// Arrivals already in stock get a green «Ya disponible» tag instead of «Próximamente»
const AVAILABLE_GREEN = '#10b981';
const StatusTag: React.FC<{ available?: boolean; primaryColor: string; className?: string }> = ({ available, primaryColor, className = '' }) => (
  <span
    className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-white ${className}`}
    style={{ backgroundColor: available ? AVAILABLE_GREEN : primaryColor }}
  >
    {available ? 'Ya disponible' : 'Próximamente'}
  </span>
);

export const Novedades: React.FC<NovedadesProps> = ({ items: loadedItems, primaryColor, bannerImage, onGoToCatalog }) => {
  const items = loadedItems ?? [];
  const loading = loadedItems === null;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const total = items.length;
  const go = (delta: number) => setOpenIndex(i => (i === null ? i : (i + delta + total) % total));

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, total]);

  const current = openIndex !== null ? items[openIndex] : null;

  return (
    <>
      {/* Banner de página */}
      <div className="relative py-16 px-6 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={bannerImage || '/img/hero_lifestyle_bg.png'} className="w-full h-full object-cover opacity-25 filter blur-sm scale-105" alt="" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>Inicio</span>
            <span className="opacity-60">/</span>
            <span style={{ color: primaryColor }} className="font-semibold">Novedades</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight max-w-xl">
            Lo que <span className="italic" style={{ color: primaryColor }}>está por llegar</span>
          </h1>
          <p className="text-sm text-slate-300 font-light max-w-lg">
            Un adelanto de los próximos ingresos. Escríbenos si quieres separar alguno antes de que llegue.
          </p>
        </div>
      </div>

      <section className="py-14 px-4 sm:px-6 bg-[#f7f7f7] dark:bg-[#0c0c0e] min-h-[50vh]">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="text-center py-20 space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                <Sparkles className="w-7 h-7" style={{ color: primaryColor }} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-serif text-slate-950 dark:text-white">Pronto tendremos novedades</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-light">Mientras tanto, revisa lo que ya tenemos disponible.</p>
              </div>
              <button
                onClick={onGoToCatalog}
                className="px-7 py-3 text-[10px] font-bold uppercase tracking-wider text-white rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                Ver productos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
              {items.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setOpenIndex(i)}
                  className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 text-left shadow-sm hover:shadow-xl transition-shadow"
                >
                  <img src={item.imageUrl} alt={item.name || 'Próximo ingreso'} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <StatusTag available={item.available} primaryColor={primaryColor} className="absolute top-3 left-3" />
                  {item.name && (
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/75 to-transparent">
                      <p className="text-white text-xs sm:text-sm font-medium line-clamp-2">{item.name}</p>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Visor de fotos */}
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setOpenIndex(null)}
          >
            <button onClick={() => setOpenIndex(null)} aria-label="Cerrar" className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10">
              <X className="w-7 h-7" />
            </button>
            {total > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); go(-1); }} aria-label="Anterior" className="absolute left-2 sm:left-6 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10">
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button onClick={e => { e.stopPropagation(); go(1); }} aria-label="Siguiente" className="absolute right-2 sm:right-6 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10">
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}
            <figure className="max-w-5xl w-full flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
              <img src={current.imageUrl} alt={current.name || 'Próximo ingreso'} className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg" />
              <figcaption className="flex flex-col items-center gap-1.5 text-center text-white/85 text-sm">
                <StatusTag available={current.available} primaryColor={primaryColor} />
                {current.name}
                {total > 1 && <span className="block text-[11px] text-white/50 mt-1">{(openIndex ?? 0) + 1} / {total}</span>}
              </figcaption>
            </figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
