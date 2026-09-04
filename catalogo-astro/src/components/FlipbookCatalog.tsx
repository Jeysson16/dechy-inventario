import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Play,
  Pause,
  Maximize,
  Minimize,
  X,
  Plus,
  Sparkles,
  ShieldCheck,
  Award,
  Zap,
  CheckCircle2,
  Eye,
  Package,
} from "lucide-react";
import { flipbookAudio } from "../utils/audioEffects";

interface FlipbookCatalogProps {
  products: any[];
  categories: string[];
  dbCategories?: any[];
  selectedBranch: any;
  onClose: () => void;
  onAddToCart: (product: any) => void;
  primaryColor?: string;
}

interface BookPage {
  type:
    | "cover"
    | "editorial"
    | "category-hero"
    | "subcategory-hero"
    | "product-grid";
  title?: string;
  subtitle?: string;
  category?: string;
  subcategory?: string;
  products?: any[];
  pageNumber: number;
}

const collator = new Intl.Collator("es", { sensitivity: "base" });
const sortByName = (items: any[]) =>
  [...items].sort((a, b) => collator.compare(a?.name || "", b?.name || ""));

export const FlipbookCatalog: React.FC<FlipbookCatalogProps> = ({
  products,
  categories,
  dbCategories = [],
  selectedBranch,
  onClose,
  onAddToCart,
  primaryColor = "#f59e0b",
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isSoundPlaying, setIsSoundPlaying] = useState(true);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState("");
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedMagProduct, setSelectedMagProduct] = useState<any | null>(
    null,
  );
  const [magModalImageIdx, setMagModalImageIdx] = useState(0);

  // Touch gesture tracking for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Auto-play music by default when entering the magazine
  useEffect(() => {
    flipbookAudio.startMusic();
    setIsSoundPlaying(true);

    return () => {
      flipbookAudio.stopMusic();
    };
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setMagModalImageIdx(0);
  }, [selectedMagProduct]);

  useEffect(() => {
    if (!selectedMagProduct) return;
    const imgs = selectedMagProduct.images?.length
      ? selectedMagProduct.images
      : selectedMagProduct.imageUrl
        ? [selectedMagProduct.imageUrl]
        : [];
    if (imgs.length <= 1) return;
    const iv = setInterval(
      () => setMagModalImageIdx((i) => (i + 1) % imgs.length),
      2000,
    );
    return () => clearInterval(iv);
  }, [selectedMagProduct]);

  // Organize catalog into individual pages
  const allPages = useMemo(() => {
    const pages: BookPage[] = [];
    let pageNum = 1;

    // Page 1: Editorial Note / Inside Cover (Left)
    pages.push({
      type: "editorial",
      title: "INNOVACIÓN & DISEÑO",
      subtitle:
        "Bienvenido al modo de lectura interactiva de nuestro catálogo oficial. Disfruta de la mejor música y diseño en una experiencia envolvente.",
      pageNumber: pageNum++,
    });

    // Page 2: Front Cover (Right)
    pages.push({
      type: "cover",
      title: selectedBranch?.name
        ? `CATÁLOGO OFICIAL — ${selectedBranch.name.toUpperCase()}`
        : "CATÁLOGO DE PRODUCTOS & SOLUCIONES 2026",
      subtitle: "COLECCIÓN EXCLUSIVA & DISPOSITIVOS DE ALTA GAMA",
      pageNumber: pageNum++,
    });

    // Cross-check subcategory names on products against the live categories collection,
    // so a subcategory deleted in the inventory app no longer produces a page here.
    const dbRootsByName = new Map<string, any>();
    dbCategories.forEach((c: any) => {
      if (!c.parentId)
        dbRootsByName.set(
          String(c.name || "")
            .toLowerCase()
            .trim(),
          c,
        );
    });
    const validSubcategoryNamesByCategory = new Map<string, Set<string>>();
    dbCategories.forEach((c: any) => {
      if (!c.parentId) return;
      const parent = dbCategories.find((p: any) => p.id === c.parentId);
      if (!parent) return;
      const key = String(parent.name || "")
        .toLowerCase()
        .trim();
      const set = validSubcategoryNamesByCategory.get(key) || new Set<string>();
      set.add(
        String(c.name || "")
          .toLowerCase()
          .trim(),
      );
      validSubcategoryNamesByCategory.set(key, set);
    });

    // Group products by category (A-Z) and, within each, by subcategory (A-Z)
    const sortedCategories = [...categories].sort((a, b) =>
      collator.compare(a, b),
    );
    const chunkSize = 4;
    const pushProductGrid = (
      cat: string,
      subcategory: string | undefined,
      list: any[],
    ) => {
      const sorted = sortByName(list);
      for (let i = 0; i < sorted.length; i += chunkSize) {
        pages.push({
          type: "product-grid",
          category: cat,
          subcategory,
          products: sorted.slice(i, i + chunkSize),
          pageNumber: pageNum++,
        });
      }
    };

    sortedCategories.forEach((cat) => {
      const catProducts = products.filter(
        (p) =>
          p.category === cat &&
          (p.currentStock > 0 ||
            p.stock > 0 ||
            p.stockManagedByDechy === false),
      );
      if (catProducts.length === 0) return;

      // Add Category Hero Page
      pages.push({
        type: "category-hero",
        category: cat,
        title: `${cat.toUpperCase()} SERIE`,
        subtitle:
          "Diseño inteligente, alta durabilidad y acabados estéticos de primera clase",
        pageNumber: pageNum++,
      });

      // Split products into: without subcategory (shown right under the category hero)
      // and grouped by subcategory (A-Z), each with its own subcategory hero spread.
      const withoutSubcategory: any[] = [];
      const bySubcategory = new Map<string, any[]>();
      const validSubNames = dbRootsByName.has(cat.toLowerCase().trim())
        ? validSubcategoryNamesByCategory.get(cat.toLowerCase().trim()) ||
          new Set<string>()
        : null;
      catProducts.forEach((p) => {
        const subName = String(p.subcategory || "").trim();
        if (
          !subName ||
          (validSubNames && !validSubNames.has(subName.toLowerCase()))
        ) {
          withoutSubcategory.push(p);
          return;
        }
        const list = bySubcategory.get(subName) || [];
        list.push(p);
        bySubcategory.set(subName, list);
      });

      pushProductGrid(cat, undefined, withoutSubcategory);

      const sortedSubcategoryNames = Array.from(bySubcategory.keys()).sort(
        (a, b) => collator.compare(a, b),
      );
      sortedSubcategoryNames.forEach((subName) => {
        pages.push({
          type: "subcategory-hero",
          category: cat,
          subcategory: subName,
          title: subName.toUpperCase(),
          pageNumber: pageNum++,
        });
        pushProductGrid(cat, subName, bySubcategory.get(subName)!);
      });
    });

    // Ensure total pages is even for desktop spreads
    if (pages.length % 2 !== 0) {
      pages.push({
        type: "editorial",
        title: "GRACIAS POR SU PREFERENCIA",
        subtitle:
          "Para cotizaciones personalizadas o pedidos especiales, consulte directamente a través de nuestro carrito o vía WhatsApp.",
        pageNumber: pageNum++,
      });
    }

    return pages;
  }, [products, categories, dbCategories, selectedBranch]);

  const totalPages = allPages.length;

  // Desktop paired pages
  const evenIndex = Math.floor(pageIndex / 2) * 2;
  const desktopLeftPage = allPages[evenIndex];
  const desktopRightPage = allPages[evenIndex + 1];

  // Mobile single page
  const mobileSinglePage = allPages[pageIndex] || allPages[0];

  const handlePageChange = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < totalPages && newIndex !== pageIndex) {
      setPageIndex(newIndex);
      flipbookAudio.playPageFlip();
    }
  };

  const toggleSound = () => {
    const active = flipbookAudio.toggleMusic();
    setIsSoundPlaying(active);
  };

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handlePageChange(pageIndex + step);
      if (e.key === "ArrowLeft") handlePageChange(pageIndex - step);
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageIndex, totalPages]);

  // Touch Swipe Handling for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handlePageChange(pageIndex + 1); // Swipe left -> next page
      } else {
        handlePageChange(pageIndex - 1); // Swipe right -> prev page
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Auto-play interval
  useEffect(() => {
    let timer: any = null;
    if (isAutoPlaying) {
      timer = setInterval(() => {
        setPageIndex((prev) => {
          const next = (prev + 1) % totalPages;
          flipbookAudio.playPageFlip();
          return next;
        });
      }, 6000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlaying, totalPages]);

  // Fullscreen handle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullScreen(true))
        .catch((err) => console.warn("Fullscreen Error:", err));
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullScreen(false))
        .catch((err) => console.warn("Exit Fullscreen Error:", err));
    }
  };

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = Number(jumpPageInput);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
      handlePageChange(targetPage - 1);
      setJumpPageInput("");
    }
  };

  const handleAddWithFeedback = (p: any) => {
    onAddToCart(p);
    setAddedToast(`¡${p.name} añadido!`);
    setTimeout(() => setAddedToast(null), 2500);
  };

  const step = isMobile ? 1 : 2;
  const magProductImages: string[] = selectedMagProduct
    ? selectedMagProduct.images?.length
      ? selectedMagProduct.images
      : selectedMagProduct.imageUrl
        ? [selectedMagProduct.imageUrl]
        : []
    : [];
  const magProductPrice = selectedMagProduct
    ? Number(selectedMagProduct.price) ||
      Number(selectedMagProduct.unitPrice) ||
      0
    : 0;

  // Render individual page content
  const renderPage = (page: BookPage) => {
    if (!page) return <div className="w-full h-full bg-slate-950" />;

    if (page.type === "editorial") {
      return (
        <div className="w-full h-full p-6 sm:p-10 flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-stone-950 text-slate-300 border-r border-slate-800/50">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-serif text-xs sm:text-sm tracking-widest uppercase mb-4">
              <Sparkles className="w-4 h-4" /> Editorial & Garantía
            </div>
            <h2 className="text-xl sm:text-3xl font-serif font-bold text-white mb-4 leading-tight">
              {page.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light mb-6 max-w-sm">
              {page.subtitle}
            </p>
            <div className="space-y-3 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Productos garantizados contra defectos de fabricación.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Acabados de lujo e inspección de calidad premium.</span>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-blue-400 shrink-0" />
                <span>
                  Atención al cliente y asesoría especializada rápida.
                </span>
              </div>
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-4 border-t border-slate-800/40 mt-6">
            <span>DECHY CORPORATIVE 2026</span>
            <span>PÁGINA {page.pageNumber}</span>
          </div>
        </div>
      );
    }

    if (page.type === "cover") {
      return (
        <div className="w-full h-full p-6 sm:p-10 flex flex-col justify-between bg-gradient-to-bl from-amber-950/40 via-slate-950 to-neutral-950 text-white relative group border-l border-slate-800/50">
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-all duration-1000" />

          <div className="z-10">
            <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-semibold tracking-widest uppercase mb-4 sm:mb-6">
              Edición Oficial
            </div>
            <h1 className="text-2xl sm:text-4xl font-serif font-extrabold tracking-tight leading-tight mb-3 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              {page.title}
            </h1>
            <div className="w-16 h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded mb-4" />
            <p className="text-xs sm:text-sm text-slate-300 font-light max-w-md">
              {page.subtitle}
            </p>
          </div>

          <div className="z-10 bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl my-4">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              Instrucciones Rápidas
            </h4>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside font-light">
              <li>
                Desliza la pantalla hacia la izquierda o derecha para cambiar
                páginas.
              </li>
              <li>
                Presiona el botón de sonido 🔊 arriba si deseas pausar o
                reproducir música.
              </li>
              <li>
                Haz clic en <strong>+ Añadir</strong> para cotizar directo.
              </li>
            </ul>
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between z-10 pt-4 border-t border-slate-800/40">
            <span>CATÁLOGO DIGITAL</span>
            <span>PÁGINA {page.pageNumber}</span>
          </div>
        </div>
      );
    }

    if (page.type === "category-hero") {
      const catKey = page.category || "";
      const dbCat = dbCategories.find(
        (c) => c.name?.toLowerCase().trim() === catKey.toLowerCase().trim(),
      );
      const catHeroImg =
        dbCat?.imageUrl ||
        selectedBranch?.configuracion?.categoriaImagenes?.[catKey] ||
        selectedBranch?.configuracion?.categoriaImagenes?.[
          catKey.toLowerCase()
        ];
      return (
        <div
          className="w-full h-full p-6 sm:p-10 flex flex-col justify-between text-white relative border-r border-slate-800/50"
          style={
            catHeroImg
              ? {
                  backgroundImage: `linear-gradient(to right, rgba(12,10,9,0.10), rgba(12,10,9,0.10)), url(${catHeroImg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background:
                    "linear-gradient(to right, #0c0a09, #0f172a, #171717)",
                }
          }
        >
          <div className="absolute -left-24 -bottom-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="z-10 mt-4 sm:mt-8">
            <span className="text-[11px] uppercase font-mono tracking-[0.3em] text-amber-400 mb-2 block">
              COLECCIÓN EXCLUSIVA
            </span>
            <h2 className="text-2xl sm:text-4xl font-serif font-extrabold tracking-tight text-white mb-4">
              {page.title}
            </h2>
            <div className="w-20 h-1 bg-amber-500 rounded mb-4" />
            <p className="text-xs sm:text-sm text-slate-300 max-w-sm font-light leading-relaxed">
              {page.subtitle}. Productos seleccionados especialmente para
              cumplir los estándares más rigurosos de calidad.
            </p>
          </div>

          <div className="z-10 grid grid-cols-2 gap-3 my-6 max-w-xs text-xs text-slate-300 font-light">
            <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded-xl">
              <span className="block font-bold text-amber-400 text-xs mb-0.5">
                100%
              </span>
              Garantía de calidad
            </div>
            <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded-xl">
              <span className="block font-bold text-amber-400 text-xs mb-0.5">
                Stock
              </span>
              Entrega inmediata
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between z-10 pt-4 border-t border-slate-800/40">
            <span className="uppercase">{page.category}</span>
            <span>PÁGINA {page.pageNumber}</span>
          </div>
        </div>
      );
    }

    if (page.type === "subcategory-hero") {
      const catKey = page.category || "";
      const dbCat = dbCategories.find(
        (c) => c.name?.toLowerCase().trim() === catKey.toLowerCase().trim(),
      );
      const catHeroImg =
        dbCat?.imageUrl ||
        selectedBranch?.configuracion?.categoriaImagenes?.[catKey] ||
        selectedBranch?.configuracion?.categoriaImagenes?.[
          catKey.toLowerCase()
        ];
      return (
        <div
          className="w-full h-full p-6 sm:p-10 flex flex-col justify-between text-white relative border-r border-slate-800/50"
          style={
            catHeroImg
              ? {
                  backgroundImage: `linear-gradient(to right, rgba(12,10,9,0.55), rgba(12,10,9,0.55)), url(${catHeroImg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background:
                    "linear-gradient(to right, #171717, #0f172a, #0c0a09)",
                }
          }
        >
          <div className="absolute -right-20 -top-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="z-10 mt-4 sm:mt-8">
            <span className="text-[11px] uppercase font-mono tracking-[0.3em] text-amber-400 mb-2 block">
              {page.category} / SUBCOLECCIÓN
            </span>
            <h2 className="text-xl sm:text-3xl font-serif font-extrabold tracking-tight text-white mb-4">
              {page.title}
            </h2>
            <div className="w-14 h-1 bg-amber-500 rounded mb-4" />
            <p className="text-xs sm:text-sm text-slate-300 max-w-sm font-light leading-relaxed">
              Modelos y variantes dentro de {page.category?.toLowerCase()} —{" "}
              {page.subtitle || page.title}.
            </p>
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between z-10 pt-4 border-t border-slate-800/40">
            <span className="uppercase">
              {page.category} — {page.subcategory}
            </span>
            <span>PÁGINA {page.pageNumber}</span>
          </div>
        </div>
      );
    }

    if (page.type === "product-grid") {
      return (
        <div className="w-full h-full p-4 sm:p-7 flex flex-col justify-between bg-gradient-to-br from-slate-950 via-neutral-950 to-zinc-950 text-white border-l border-slate-800/50">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest font-mono">
                {page.category}
                {page.subcategory ? ` — ${page.subcategory}` : ""}
              </span>
              <span className="text-[10px] font-light text-slate-400">
                Modelos & Precios
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {page.products?.map((p, idx) => {
                const img =
                  p.images?.[0] || p.imageUrl || "/img/hero_lifestyle_bg.png";
                const price = Number(p.price) || Number(p.unitPrice) || 0;
                return (
                  <div
                    key={p.id || idx}
                    className="group flex flex-col bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800/80 hover:border-amber-500/40 rounded-xl overflow-hidden transition-all duration-300 p-2.5 shadow-lg"
                  >
                    <div className="relative w-full h-28 sm:h-36 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center mb-2 border border-slate-800/50">
                      <img
                        src={img}
                        alt={p.name}
                        className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {p.isOnSale && (
                        <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          OFERTA
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMagProduct(p);
                        }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-slate-950/70 hover:bg-amber-500 text-slate-300 hover:text-slate-950 transition-all backdrop-blur-sm border border-slate-700/50 opacity-0 group-hover:opacity-100"
                        title="Ver detalles"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[10px] font-extrabold text-amber-400 tracking-wider uppercase truncate">
                            {p.sku || p.code || `MOD-${idx + 1}`}
                          </span>
                          <span className="text-xs font-extrabold text-emerald-400">
                            S/ {price.toFixed(2)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-200 line-clamp-1 group-hover:text-white transition-colors mb-1">
                          {p.name}
                        </h4>
                      </div>

                      <div className="text-[10px] text-slate-400 space-y-0.5 mb-2 pt-1 border-t border-slate-800/60 font-light">
                        <div className="flex justify-between">
                          <span>Categoría:</span>
                          <span className="text-slate-300 truncate font-mono max-w-[100px]">
                            {p.category || "Varios"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stock:</span>
                          <span
                            className={
                              p.currentStock > 0
                                ? "text-emerald-400 font-semibold"
                                : "text-amber-400"
                            }
                          >
                            {p.currentStock > 0
                              ? `${p.currentStock} unid.`
                              : "Consultar"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddWithFeedback(p)}
                        className="w-full mt-auto bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700/80 hover:border-amber-400 text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1 shadow-sm active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Añadir a Cotización</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between pt-3 border-t border-slate-800/40 mt-3">
            <span>CATÁLOGO DE MODELOS</span>
            <span>PÁGINA {page.pageNumber}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col justify-between select-none overflow-hidden text-white font-sans">
      {/* Toast feedback when adding product */}
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-[300] bg-emerald-500 text-slate-950 font-extrabold px-5 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs border border-white/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{addedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP CONTROLS BAR (Clean & minimal, removed top "MODO REVISTA" badge) */}
      <div className="w-full py-2 px-3 sm:px-8 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-center sm:justify-between z-30 shadow-2xl">
        <div className="hidden sm:block" />

        {/* Center Control Pill */}
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-900 border border-slate-700/80 rounded-full px-3 py-1 shadow-xl text-slate-300 text-xs font-medium">
          {/* Zoom Controls */}
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className={`p-1.5 rounded-full transition-colors ${isZoomed ? "bg-amber-500 text-slate-950" : "hover:bg-slate-800 hover:text-white"}`}
            title="Zoom (Ampliar/Reducir)"
          >
            {isZoomed ? (
              <ZoomOut className="w-3.5 h-3.5" />
            ) : (
              <ZoomIn className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-full transition-colors relative flex items-center gap-1 ${isSoundPlaying ? "bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "hover:bg-slate-800 hover:text-white text-slate-400"}`}
            title="Música de Fondo"
          >
            {isSoundPlaying ? (
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />

          {/* Navigation Controls */}
          <button
            onClick={() => handlePageChange(0)}
            disabled={pageIndex === 0}
            className="p-1 hover:bg-slate-800 hover:text-white rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Primera página"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handlePageChange(pageIndex - step)}
            disabled={pageIndex === 0}
            className="p-1 hover:bg-slate-800 hover:text-white rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Página Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-mono px-1.5 text-slate-200 text-xs font-bold">
            {pageIndex + 1} / {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(pageIndex + step)}
            disabled={pageIndex === totalPages - 1}
            className="p-1 hover:bg-slate-800 hover:text-white rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Página Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handlePageChange(totalPages - 1)}
            disabled={pageIndex === totalPages - 1}
            className="p-1 hover:bg-slate-800 hover:text-white rounded-full disabled:opacity-30 disabled:hover:bg-transparent"
            title="Última página"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Auto Play */}
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`p-1.5 rounded-full transition-colors hidden sm:inline-block ${isAutoPlaying ? "bg-amber-500 text-slate-950" : "hover:bg-slate-800 hover:text-white"}`}
            title="Pase automático"
          >
            {isAutoPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullScreen}
            className="p-1.5 hover:bg-slate-800 hover:text-white rounded-full hidden sm:inline-block"
            title="Pantalla completa"
          >
            {isFullScreen ? (
              <Minimize className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Right Corner: Close Button */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/50 px-3.5 py-1 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cerrar</span>
          </button>
        </div>
      </div>

      {/* MAIN BOOK SPREAD VIEWPORT WITH TOUCH SWIPE FOR MOBILE */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 relative flex items-center justify-center p-2 sm:p-6 md:p-10 overflow-y-auto overflow-x-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-neutral-950 touch-pan-y"
      >
        {/* Left Big Arrow (Desktop & Tablet) */}
        <button
          onClick={() => handlePageChange(pageIndex - step)}
          disabled={pageIndex === 0}
          className="absolute left-2 sm:left-4 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-amber-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-amber-400 flex items-center justify-center shadow-2xl disabled:opacity-20 transition-all transform hover:scale-105 active:scale-95 hidden md:flex"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Right Big Arrow (Desktop & Tablet) */}
        <button
          onClick={() => handlePageChange(pageIndex + step)}
          disabled={pageIndex === totalPages - 1}
          className="absolute right-2 sm:right-4 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-amber-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-amber-400 flex items-center justify-center shadow-2xl disabled:opacity-20 transition-all transform hover:scale-105 active:scale-95 hidden md:flex"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* The Book Container */}
        <div
          className={`w-full max-w-6xl transition-transform duration-500 ${isZoomed ? "scale-110 md:scale-125 my-8" : "scale-100"} perspective-[2000px]`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pageIndex}
              initial={{ rotateY: 12, opacity: 0, scale: 0.96 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              exit={{ rotateY: -12, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="w-full border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.85)] bg-slate-950"
            >
              {/* DESKTOP VIEW: 2 PAGES SIDE-BY-SIDE */}
              <div className="hidden md:grid grid-cols-2 min-h-[580px] lg:min-h-[640px] relative">
                {/* Central spine shadow */}
                <div className="absolute left-1/2 -translate-x-1/2 w-8 h-full z-20 pointer-events-none bg-gradient-to-r from-black/50 via-neutral-900/40 to-black/50 shadow-[0_0_20px_rgba(0,0,0,0.8)] border-x border-white/5" />

                <div className="w-full h-full relative z-10 flex flex-col bg-slate-950">
                  {renderPage(desktopLeftPage)}
                </div>

                <div className="w-full h-full relative z-10 flex flex-col bg-slate-950">
                  {renderPage(desktopRightPage)}
                </div>
              </div>

              {/* MOBILE VIEW: EXACTLY 1 SINGLE PAGE AT A TIME */}
              <div className="block md:hidden w-full min-h-[480px] sm:min-h-[540px]">
                {renderPage(mobileSinglePage)}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* MOBILE NAVIGATION CONTROL BAR (Floating at bottom for mobile) */}
      <div className="flex md:hidden items-center justify-between px-4 py-2 bg-slate-900/95 border-t border-slate-800 z-30">
        <button
          onClick={() => handlePageChange(pageIndex - 1)}
          disabled={pageIndex === 0}
          className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 rounded-full text-xs font-bold disabled:opacity-30 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>

        <span className="font-mono text-xs text-amber-400 font-bold">
          Pág {pageIndex + 1} / {totalPages}
        </span>

        <button
          onClick={() => handlePageChange(pageIndex + 1)}
          disabled={pageIndex === totalPages - 1}
          className="flex items-center gap-1 px-3.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 rounded-full text-xs font-bold disabled:opacity-30 active:scale-95 transition-all"
        >
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={onClose}
          className="p-1.5 bg-red-600/30 text-red-300 rounded-full active:scale-95 ml-2"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* BOTTOM PAGINATION THUMBS */}
      <div className="w-full py-2.5 px-4 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-md flex items-center justify-center gap-1.5 overflow-x-auto z-30 scrollbar-thin scrollbar-thumb-slate-700">
        {allPages.map((page, idx) => {
          const isSelected = idx === pageIndex;

          return (
            <button
              key={idx}
              onClick={() => handlePageChange(idx)}
              className={`px-3 py-1 rounded-full font-mono text-[11px] font-bold tracking-tight transition-all shrink-0 ${
                isSelected
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 scale-105 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {page.pageNumber}
            </button>
          );
        })}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedMagProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedMagProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedMagProduct(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-red-600 text-slate-300 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col sm:flex-row">
                {/* Left: main photo + details */}
                <div className="flex flex-col gap-3 p-5 sm:w-[42%] border-b sm:border-b-0 sm:border-r border-slate-800">
                  <div className="w-full aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                    {magProductImages[0] ? (
                      <img
                        src={magProductImages[0]}
                        alt={selectedMagProduct.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-slate-700" />
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="font-mono text-amber-400 font-extrabold text-[11px] tracking-wider uppercase">
                      {selectedMagProduct.sku || selectedMagProduct.code || "—"}
                    </div>
                    <h3 className="text-white font-bold text-sm leading-snug">
                      {selectedMagProduct.name}
                    </h3>
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800">
                      <span className="text-slate-400">Precio:</span>
                      <span className="text-emerald-400 font-extrabold text-sm">
                        S/ {magProductPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Categoría:</span>
                      <span className="text-slate-200">
                        {selectedMagProduct.category || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Stock:</span>
                      <span
                        className={
                          selectedMagProduct.currentStock > 0
                            ? "text-emerald-400 font-semibold"
                            : "text-amber-400"
                        }
                      >
                        {selectedMagProduct.currentStock > 0
                          ? `${selectedMagProduct.currentStock} unid.`
                          : "Consultar"}
                      </span>
                    </div>
                    {selectedMagProduct.description && (
                      <p className="text-slate-400 text-[11px] pt-1.5 border-t border-slate-800 leading-relaxed whitespace-pre-line">
                        {selectedMagProduct.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: complementary gallery */}
                <div className="flex flex-col sm:w-[58%] p-5">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-3">
                    Galería de Imágenes
                  </div>
                  {magProductImages.length > 0 ? (
                    <>
                      <div
                        className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center"
                        style={{ minHeight: 220 }}
                      >
                        <img
                          key={magModalImageIdx}
                          src={magProductImages[magModalImageIdx]}
                          alt={`${selectedMagProduct.name} — imagen ${magModalImageIdx + 1}`}
                          className="w-full object-contain p-2 max-h-[260px]"
                        />
                        {magProductImages.length > 1 && (
                          <>
                            <button
                              onClick={() =>
                                setMagModalImageIdx(
                                  (i) =>
                                    (i - 1 + magProductImages.length) %
                                    magProductImages.length,
                                )
                              }
                              className="absolute left-2 w-7 h-7 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setMagModalImageIdx(
                                  (i) => (i + 1) % magProductImages.length,
                                )
                              }
                              className="absolute right-2 w-7 h-7 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-all"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                      {magProductImages.length > 1 && (
                        <div className="flex items-center justify-center gap-1.5 mt-2.5">
                          {magProductImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setMagModalImageIdx(i)}
                              className={`rounded-full transition-all ${i === magModalImageIdx ? "w-4 h-1.5 bg-amber-500" : "w-1.5 h-1.5 bg-slate-600 hover:bg-slate-400"}`}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-700">
                      <Package className="w-12 h-12" />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      handleAddWithFeedback(selectedMagProduct);
                      setSelectedMagProduct(null);
                    }}
                    className="mt-4 w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir a Cotización
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
