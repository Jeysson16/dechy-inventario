import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Minus, Plus, Package, ShoppingBag, ClipboardList } from 'lucide-react';
import { CategoryAccordion, type CategoryWithSubcategories } from './CategoryAccordion';
import { StockBadge } from './StockBadge';
import { boxPriceApplies, boxPriceOf, displayPrice, hasBoxPricing, isInStock, lineTotal, unitPriceOf } from '../utils/catalogProduct';

type MediaItem = { url: string; mediaType: 'image' | 'video' | string };

interface ProductDetailProps {
  product: any;
  products: any[];
  categories: CategoryWithSubcategories[];
  primaryColor: string;
  cartQty: number;
  onSetCartQty: (qty: number) => void;
  onOpenCart: () => void;
  onOpenProduct: (product: any) => void;
  onGoToCatalog: (category?: string, subcategoryId?: string | null) => void;
  onGoHome: () => void;
}

const norm = (v: any) => String(v || '').toLowerCase().trim();
const money = (n: any) => `S/ ${Number(n || 0).toFixed(2)}`;

// "60x60x0.5 cm" is useful, "0x0x0 cm" is a placeholder the inventory saves by default
const readableDimensions = (p: any): string => {
  if (p.dimensions && !/^0\s*x\s*0(\s*x\s*0)?/i.test(String(p.dimensions).trim())) return p.dimensions;
  const l = Number(p.length) || 0, w = Number(p.width) || 0, h = Number(p.height) || 0;
  if (!l && !w && !h) return '';
  return `${l}x${w}${h ? `x${h}` : ''} cm`;
};

// Descriptions are free text: one bullet per line, or per sentence when it is a single block
const descriptionBullets = (text: string): string[] => {
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/^[-•*·\s]+/, '').trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  return (lines[0] || '').split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/).map(s => s.trim()).filter(Boolean);
};

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="space-y-5"
  >
    <h2 className="font-product text-[26px] sm:text-[28px] font-bold text-slate-950 dark:text-white pb-3 border-b border-slate-300/80 dark:border-white/10">{title}</h2>
    <div className="bg-white dark:bg-slate-900 rounded-xl px-5 py-5 sm:px-7 sm:py-6 font-product text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
      {children}
    </div>
  </motion.section>
);

const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-3">
        <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-300 shrink-0" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product, products, categories, primaryColor, cartQty, onSetCartQty, onOpenCart, onOpenProduct, onGoToCatalog, onGoHome,
}) => {
  const media: MediaItem[] = product.mediaItems?.length
    ? product.mediaItems
    : (product.imageUrl ? [{ url: product.imageUrl, mediaType: 'image' }] : []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState<{ on: boolean; x: number; y: number }>({ on: false, x: 50, y: 50 });
  const upb = Number(product.unitsPerBox) > 1 ? Number(product.unitsPerBox) : 0;
  const [units, setUnits] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const recRef = useRef<HTMLDivElement>(null);

  // Start every product at its first image, with the quantity already in the selection
  useEffect(() => {
    setActiveIdx(0);
    setUnits(cartQty > 0 ? cartQty : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const totalUnits = units;
  const current = media[activeIdx] || media[0];
  const isVideo = current?.mediaType === 'video';
  const outOfStock = !isInStock(product);
  const shownPrice = displayPrice(product);
  const boxPricing = hasBoxPricing(product);
  const boxPrice = boxPriceOf(product);
  const fullBoxes = upb ? Math.floor(totalUnits / upb) : 0;
  const looseUnits = upb ? totalUnits % upb : totalUnits;
  const onSale = shownPrice.regular !== undefined;

  const specs = useMemo(() => {
    const rows: [string, string][] = [];
    const push = (label: string, value: any) => { if (value !== undefined && value !== null && String(value).trim() !== '') rows.push([label, String(value)]); };
    push('Código', product.sku || product.code);
    push('Categoría', product.category);
    push('Subcategoría', product.subcategory);
    push('Marca', product.brand);
    push('Medidas', readableDimensions(product));
    push('Unidad de medida', product.measurementUnit);
    if (upb) push('Contenido por caja', `${upb} unidades`);
    push('Disponibilidad', outOfStock ? 'Sin stock' : 'En stock');
    return rows;
  }, [product, upb, outOfStock]);

  const volumePrices = useMemo(() => {
    const rows: string[] = [];
    if (boxPricing) rows.push(`Precio por caja (${upb} u.): ${money(boxPrice)} — se aplica automáticamente al completar una caja`);
    if (Number(product.dozenPrice) > 0) rows.push(`Precio por docena: ${money(product.dozenPrice)}`);
    if (Number(product.wholesalePrice) > 0) {
      const threshold = Number(product.wholesaleThreshold) || 0;
      rows.push(`Precio por mayor: ${money(product.wholesalePrice)}${threshold ? ` desde ${threshold} ${product.wholesaleThresholdUnit === 'unidades' ? 'unidades' : 'cajas'}` : ''}`);
    }
    return rows;
  }, [product, upb, boxPricing, boxPrice]);

  const components: string[] = Array.isArray(product.componentsSummary) ? product.componentsSummary.filter(Boolean) : [];
  const extras: any[] = Array.isArray(product.extras) ? product.extras.filter((e: any) => e?.productName) : [];

  // Same subcategory first, then same category, then anything else — never the product itself
  const recommended = useMemo(() => {
    const pool = products.filter(p => p.id !== product.id && (p.imageUrl || p.images?.length));
    const score = (p: any) =>
      (product.subcategory && norm(p.subcategory) === norm(product.subcategory) ? 2 : 0) +
      (norm(p.category) === norm(product.category) ? 1 : 0) +
      (Number(p.currentStock) > 0 ? 0.5 : 0);
    return pool.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).slice(0, 12).map(x => x.p);
  }, [products, product]);

  const addToSelection = () => {
    if (totalUnits <= 0) return;
    onSetCartQty(totalUnits);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  const scrollRecommended = (dir: 1 | -1) => {
    const el = recRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const stepper = (label: string, value: number, set: (v: number) => void) => (
    <div className="space-y-1.5">
      <span className="font-label text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="flex items-center w-36 h-11 rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10">
        <button type="button" onClick={() => set(Math.max(0, value - 1))} className="w-11 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label={`Menos ${label}`}>
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={e => set(Math.max(0, parseInt(e.target.value) || 0))}
          className="flex-1 min-w-0 text-center bg-transparent outline-none font-product text-[15px] font-bold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" onClick={() => set(value + 1)} className="w-11 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label={`Más ${label}`}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-[#f7f7f7] dark:bg-[#0c0c0e]">
      {/* ── Breadcrumb ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 font-label text-[12px] tracking-wide text-slate-500 flex flex-wrap items-center gap-1.5">
        <button onClick={onGoHome} className="hover:text-slate-900 dark:hover:text-white transition-colors">Inicio</button>
        <span>/</span>
        <button onClick={() => onGoToCatalog()} className="hover:text-slate-900 dark:hover:text-white transition-colors">Catálogo</button>
        {product.category && (<><span>/</span><button onClick={() => onGoToCatalog(product.category)} className="capitalize hover:text-slate-900 dark:hover:text-white transition-colors">{norm(product.category)}</button></>)}
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 truncate max-w-full">{product.name}</span>
      </div>

      {/* ── Gallery + summary ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-10 lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-4"
        >
          {media.length > 1 && (
            <div className="hidden sm:flex flex-col gap-3 w-[68px] shrink-0 max-h-[620px] overflow-y-auto hide-scrollbar">
              {media.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-[66px] h-[66px] bg-white shrink-0 overflow-hidden transition-all ${i === activeIdx ? 'ring-1 ring-slate-900 dark:ring-white' : 'opacity-70 hover:opacity-100'}`}
                >
                  {m.mediaType === 'video'
                    ? <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                    : <img src={m.url} alt="" className="w-full h-full object-contain p-1" />}
                </button>
              ))}
            </div>
          )}

          <div
            className={`group relative flex-1 aspect-square bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 overflow-hidden ${isVideo ? '' : 'cursor-zoom-in'}`}
            onMouseMove={e => {
              if (isVideo) return;
              const r = e.currentTarget.getBoundingClientRect();
              setZoom({ on: true, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            onMouseLeave={() => setZoom(z => ({ ...z, on: false }))}
          >
            {current ? (
              isVideo ? (
                <video key={current.url} src={current.url} controls className="absolute inset-0 w-full h-full object-contain bg-black" />
              ) : (
                <>
                  <motion.img
                    key={current.url}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    src={current.url}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-contain p-5 sm:p-10"
                  />
                  {/* Magnifier: 2.8× following the cursor */}
                  <div
                    className={`absolute inset-0 bg-white transition-opacity duration-200 pointer-events-none ${zoom.on ? 'opacity-100' : 'opacity-0'}`}
                    style={{ backgroundImage: `url(${current.url})`, backgroundRepeat: 'no-repeat', backgroundSize: '280%', backgroundPosition: `${zoom.x}% ${zoom.y}%` }}
                  />
                </>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"><Package className="w-16 h-16 text-slate-300" /></div>
            )}

            {media.length > 1 && (
              <>
                <button onClick={() => setActiveIdx(i => (i - 1 + media.length) % media.length)} aria-label="Anterior" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                  <ChevronLeft className="w-5 h-5 text-slate-700" />
                </button>
                <button onClick={() => setActiveIdx(i => (i + 1) % media.length)} aria-label="Siguiente" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                  <ChevronRight className="w-5 h-5 text-slate-700" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {media.map((_, i) => (
                    <button key={i} onClick={() => setActiveIdx(i)} aria-label={`Imagen ${i + 1}`} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === activeIdx ? 'bg-[#1f2a4d]' : 'bg-slate-300 hover:bg-slate-400'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col"
        >
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-product text-[26px] sm:text-[34px] leading-tight text-slate-950 dark:text-white break-words min-w-0">{product.name}</h1>
            <StockBadge inStock={!outOfStock} className="mt-2 sm:mt-3 shrink-0 text-[11px] px-3 py-1" />
          </div>
          <p className="font-product text-[15px] text-slate-600 dark:text-slate-400 mt-1 capitalize">
            {norm(product.subcategory || product.category)}
          </p>

          {/* Quick facts in round badges, like certification seals */}
          <div className="flex flex-wrap gap-3 sm:gap-4 mt-7">
            {[
              product.sku && { top: 'Código', value: product.sku },
              upb && { top: 'Caja', value: `${upb} u.` },
            ].filter(Boolean).map((b: any) => (
              <div key={b.top} className="w-[76px] h-[76px] sm:w-[82px] sm:h-[82px] rounded-full bg-white dark:bg-slate-900 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.25)] flex flex-col items-center justify-center text-center px-2 transition-transform hover:-translate-y-1">
                <span className="font-label text-[9px] uppercase tracking-[0.14em] text-slate-400">{b.top}</span>
                <span className="font-product text-[13px] font-bold text-slate-900 dark:text-white truncate max-w-full">{b.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-product text-[28px] sm:text-[30px] font-bold text-slate-950 dark:text-white">{money(shownPrice.amount)}</span>
            <span className="font-label text-[13px] text-slate-500 mb-1.5">/ unidad</span>
            {onSale && <span className="font-product text-[16px] text-slate-400 line-through mb-1">{money(shownPrice.regular)}</span>}
            {onSale && product.discountPercent ? <span className="mb-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold text-white bg-rose-500">-{product.discountPercent}%</span> : null}
          </div>

          {boxPricing && (
            <p className="mt-2 font-label text-[13px] text-slate-600 dark:text-slate-300">
              Caja de {upb} u.: <span className="font-bold text-slate-900 dark:text-white">{money(boxPrice)}</span>
              <span className="text-slate-500"> · al completar una caja se cobra a precio de caja</span>
            </p>
          )}

          {!outOfStock && (
            <div className="mt-6 flex flex-wrap gap-6">
              {stepper('Cantidad (unidades)', units, setUnits)}
            </div>
          )}
          {!outOfStock && totalUnits > 0 && (
            <div className="mt-3 font-label text-[12px] text-slate-500 space-y-0.5">
              {boxPriceApplies(product, totalUnits) ? (
                <>
                  <p>
                    {fullBoxes} caja{fullBoxes !== 1 ? 's' : ''} × {money(boxPrice)}
                    {looseUnits > 0 && <> + {looseUnits} u. × {money(unitPriceOf(product))}</>}
                  </p>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">Precio de caja aplicado</p>
                </>
              ) : (
                <p>
                  {totalUnits} u. × {money(unitPriceOf(product))}
                  {boxPricing && <> · faltan {upb - totalUnits} u. para precio de caja</>}
                </p>
              )}
              <p className="text-[13px] font-bold text-slate-900 dark:text-white">Total: {money(lineTotal(product, totalUnits))}</p>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={addToSelection}
              disabled={outOfStock || totalUnits <= 0}
              className="h-12 rounded-full bg-[#8a8a8a] hover:bg-[#6f6f6f] disabled:opacity-50 disabled:cursor-not-allowed text-white font-label text-[15px] flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <ShoppingBag className="w-4 h-4" />
              {justAdded ? '¡Agregado!' : cartQty > 0 ? 'Actualizar selección' : 'Agregar a mi selección'}
            </button>
            <button
              onClick={onOpenCart}
              className="h-12 rounded-full bg-[#1f2a4d] hover:bg-[#162038] text-white font-label text-[15px] flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <ClipboardList className="w-4 h-4" /> Ver mi selección
            </button>
          </div>
          {cartQty > 0 && (
            <button onClick={() => onSetCartQty(0)} className="mt-3 self-start font-label text-[12px] text-rose-500 hover:underline">
              Quitar de mi selección
            </button>
          )}
          <div className="mt-8 border-b border-slate-300/80 dark:border-white/10" />
        </motion.div>
      </section>

      {/* ── Category sidebar + detail sections ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 grid lg:grid-cols-[300px_1fr] gap-10 items-start">
        <CategoryAccordion
          categories={categories}
          selectedCategory={product.category || 'Todos'}
          selectedSubcategory={product.subcategoryId || null}
          onSelectCategory={cat => onGoToCatalog(cat)}
          onSelectSubcategory={(parent, subId) => onGoToCatalog(parent, subId)}
          primaryColor={primaryColor}
          resultCount={products.length}
        />

        <div className="space-y-14 min-w-0">
          <SectionCard title="Detalles del producto">
            {product.description
              ? <Bullets items={descriptionBullets(product.description)} />
              : <p className="text-slate-500">Consúltanos por WhatsApp para más información sobre este producto.</p>}
          </SectionCard>

          {specs.length > 0 && (
            <SectionCard title="Información técnica">
              <Bullets items={specs.map(([label, value]) => <><span className="text-slate-500 dark:text-slate-400">{label}:</span> <span className={label === 'Categoría' || label === 'Subcategoría' ? 'capitalize' : ''}>{label === 'Categoría' || label === 'Subcategoría' ? norm(value) : value}</span></>)} />
            </SectionCard>
          )}

          {volumePrices.length > 0 && (
            <SectionCard title="Precios por volumen">
              <Bullets items={volumePrices} />
            </SectionCard>
          )}

          {components.length > 0 && (
            <SectionCard title="Incluye">
              <Bullets items={components} />
            </SectionCard>
          )}

          {extras.length > 0 && (
            <SectionCard title="Accesorios recomendados">
              <ul className="divide-y divide-slate-100 dark:divide-white/10 -my-2">
                {extras.map((ex, i) => {
                  const linked = products.find(p => p.id === ex.productId);
                  return (
                    <li key={i}>
                      <button
                        onClick={() => linked && onOpenProduct(linked)}
                        disabled={!linked}
                        className="w-full flex items-center gap-4 py-3 text-left group disabled:cursor-default"
                      >
                        <div className="w-14 h-14 bg-white rounded-lg overflow-hidden ring-1 ring-slate-100 shrink-0">
                          {ex.imageUrl ? <img src={ex.imageUrl} alt="" className="w-full h-full object-contain" /> : <Package className="w-6 h-6 m-4 text-slate-300" />}
                        </div>
                        <span className="flex-1 group-enabled:group-hover:underline">{ex.productName}</span>
                        {Number(ex.price) > 0 && <span className="text-slate-500 text-[14px]">{money(ex.price)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )}
        </div>
      </section>

      {/* ── Recommended products ── */}
      {recommended.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
          <div className="flex items-end justify-between pb-3 border-b border-slate-300/80 dark:border-white/10">
            <h2 className="font-product text-[26px] sm:text-[28px] font-bold text-slate-950 dark:text-white">Productos recomendados</h2>
            <div className="flex gap-2 mb-1">
              <button onClick={() => scrollRecommended(-1)} aria-label="Anterior" className="w-9 h-9 rounded-full ring-1 ring-slate-300 dark:ring-white/20 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => scrollRecommended(1)} aria-label="Siguiente" className="w-9 h-9 rounded-full bg-[#1f2a4d] text-white flex items-center justify-center hover:bg-[#162038] transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div ref={recRef} className="mt-6 flex gap-5 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-2">
            {recommended.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: Math.min(i, 4) * 0.06 }}
                onClick={() => onOpenProduct(p)}
                className="group snap-start shrink-0 w-[calc(50%-10px)] sm:w-[calc(33.333%-14px)] lg:w-[calc(25%-15px)] text-left"
              >
                <div className="aspect-square bg-white dark:bg-slate-900 rounded-xl overflow-hidden transition-shadow duration-300 group-hover:shadow-[0_18px_40px_-16px_rgba(15,23,42,0.25)]">
                  <img src={p.images?.[0] || p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-contain p-6 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.1]" />
                </div>
                <p className="mt-4 font-label text-[14px] font-bold tracking-[0.06em] text-slate-950 dark:text-white line-clamp-2">{p.name}</p>
                <p className="mt-1 font-label text-[13px] tracking-[0.06em] text-slate-500 capitalize">{norm(p.subcategory || p.category)}</p>
              </motion.button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
