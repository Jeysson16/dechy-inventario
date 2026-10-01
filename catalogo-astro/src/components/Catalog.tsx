import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, query, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { boxPriceApplies, decorateCatalogProduct, isCatalogProductVisible, lineTotal } from '../utils/catalogProduct';
import { ProductCard } from './ProductCard';
import { SharedCartView } from './SharedCartView';
import { FlipbookCatalog } from './FlipbookCatalog';
import { CategoryAccordion } from './CategoryAccordion';
import { Nosotros } from './Nosotros';
import { ProductDetail } from './ProductDetail';
import { flipbookAudio } from '../utils/audioEffects';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, Moon, Sun, X, Package as PackageIcon, ChevronDown, Plus, Minus, Share2, Truck, MessageSquare, FileText, Mail, Phone, MapPin, ChevronLeft, ChevronRight, Trash2, Menu } from 'lucide-react';

interface CatalogProps {
  initialFlipbook?: boolean;
}

// Last loaded company + products + categories, kept in localStorage so a product
// opened in a new tab (or a reload) renders immediately while live data catches up
type CatalogSnapshot = { branch: any; products: any[]; categories: any[] };
const snapshotKey = () => {
  const branchParam = new URLSearchParams(window.location.search).get('branch') || '';
  return `catalog-snapshot:v1:${window.location.hostname}:${branchParam}`;
};
const readSnapshot = (): CatalogSnapshot | null => {
  try {
    const data = JSON.parse(localStorage.getItem(snapshotKey()) || 'null');
    return data?.branch && Array.isArray(data.products) && data.products.length > 0 ? data : null;
  } catch {
    return null;
  }
};
const writeSnapshot = (data: CatalogSnapshot) => {
  try {
    localStorage.setItem(snapshotKey(), JSON.stringify(data));
  } catch { /* quota or storage disabled: next load just waits for Firestore */ }
};
const branchLogoUrl = (branch: any) => branch?.configuracion?.logo || branch?.logo || '';

export const Catalog: React.FC<CatalogProps> = ({ initialFlipbook = false }) => {
  const [snapshot] = useState(readSnapshot);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(snapshot?.branch ?? null);
  const [products, setProducts] = useState<any[]>(snapshot?.products ?? []);
  const [loading, setLoading] = useState(!snapshot);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [dbCategories, setDbCategories] = useState<any[]>(snapshot?.categories ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [featuredIndex, setFeaturedIndex] = useState<number>(0);
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(true);
  const [visibleCount, setVisibleCount] = useState<number>(4);
  const isClickScrollingRef = useRef(false);
  const categoriesTrayRef = useRef<HTMLDivElement>(null);

  const scrollCategoriesTray = (direction: 'left' | 'right') => {
    if (categoriesTrayRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      categoriesTrayRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  const [cart, setCart] = useState<Record<string, { product: any; qty: number }>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFlipbook, setShowFlipbook] = useState(initialFlipbook);

  const openFlipbook = () => {
    setShowFlipbook(true);
    if (typeof window !== 'undefined' && window.location.pathname !== '/revista') {
      window.history.pushState({ flipbook: true }, '', '/revista');
    }
  };

  const closeFlipbook = () => {
    setShowFlipbook(false);
    flipbookAudio.stopMusic();
    if (typeof window !== 'undefined' && window.location.pathname === '/revista') {
      window.history.pushState({ flipbook: false }, '', '/');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (initialFlipbook || window.location.pathname.includes('/revista')) {
        setShowFlipbook(true);
      }
      const handlePopState = () => {
        if (window.location.pathname.includes('/revista')) {
          setShowFlipbook(true);
        } else {
          setShowFlipbook(false);
          flipbookAudio.stopMusic();
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [initialFlipbook]);
  const [shareQr, setShareQr] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [logoReady, setLogoReady] = useState(Boolean(snapshot));
  const readyLogoRef = useRef<string | null>(snapshot ? branchLogoUrl(snapshot.branch) : null);
  const [clientData, setClientData] = useState({ name: '', dni: '', phone: '' });
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [sharedCart, setSharedCart] = useState<Record<string, { product: any; qty: number }> | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroCatIndex, setHeroCatIndex] = useState<number>(0);

  // Home vs Full Catalog View state tabs
  const [pendingProductParam, setPendingProductParam] = useState<string | null>(() => new URLSearchParams(window.location.search).get('producto'));
  const [activeTab, setActiveTab] = useState<'inicio' | 'catalogo' | 'nosotros'>(() => (pendingProductParam ? 'catalogo' : 'inicio'));
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'alpha'>('default');

  const addToCart = (p: any) => setCart(prev => {
    const existing = prev[p.id];
    return { ...prev, [p.id]: { product: p, qty: existing ? existing.qty + 1 : 1 } };
  });
  const removeFromCart = (id: string) => setCart(prev => {
    const c = { ...prev };
    if (c[id] && c[id].qty > 1) c[id] = { ...c[id], qty: c[id].qty - 1 };
    else delete c[id];
    return c;
  });
  const updateCartQty = (id: string, qty: number, product?: any) => setCart(prev => {
    const c = { ...prev };
    if (qty <= 0) {
      delete c[id];
    } else {
      const existing = c[id];
      const p = product || (existing ? existing.product : null);
      if (p) {
        c[id] = { product: p, qty };
      }
    }
    return c;
  });
  const cartCount = Object.values(cart).reduce((s, v) => s + v.qty, 0);
  const cartTotal = Object.values(cart).reduce((s, v) => s + lineTotal(v.product, v.qty), 0);

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedSubcategory(null);
  };

  const handleSelectSubcategory = (parentName: string, subId: string | null) => {
    setSelectedCategory(parentName);
    setSelectedSubcategory(subId);
  };

  const generateShareLink = () => {
    const items = Object.values(cart).map(v => `${encodeURIComponent(v.product.name.trim())}:${v.qty}`);
    const cartString = items.join(',');
    let url = `${window.location.origin}${window.location.pathname}?cart=${cartString}&branch=${selectedBranch?.id || ''}`;
    if (clientData.name || clientData.dni) {
      url += `&clientName=${encodeURIComponent(clientData.name)}&clientDNI=${encodeURIComponent(clientData.dni)}&clientPhone=${encodeURIComponent(clientData.phone)}`;
    }
    setShareUrl(url);
    setShareQr(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`);
  };

  const shareViaWhatsApp = () => {
    const items = Object.values(cart).map(v => `${encodeURIComponent(v.product.name.trim())}:${v.qty}`);
    const cartString = items.join(',');
    let url = `${window.location.origin}${window.location.pathname}?cart=${cartString}&branch=${selectedBranch?.id || ''}`;
    if (clientData.name || clientData.dni) {
      url += `&clientName=${encodeURIComponent(clientData.name)}&clientDNI=${encodeURIComponent(clientData.dni)}&clientPhone=${encodeURIComponent(clientData.phone)}`;
    }

    let message = `*Nuevo pedido - Dechy Inventario*\n\n`;
    message += `Hola, me gustaría cotizar/solicitar los siguientes productos:\n\n`;

    Object.values(cart).forEach(({ product: p, qty }) => {
      const upb = p.unitsPerBox || 1;
      let qtyStr = '';
      if (p.unitsPerBox && p.unitsPerBox > 1) {
        const boxes = Math.floor(qty / upb);
        const units = qty % upb;
        const parts = [];
        if (boxes > 0) parts.push(`${boxes} ${boxes === 1 ? 'caja' : 'cajas'}`);
        if (units > 0) parts.push(`${units} ${units === 1 ? 'unidad' : 'unidades'}`);
        qtyStr = parts.join(' y ');
      } else {
        qtyStr = `${qty} ${qty === 1 ? 'unidad' : 'unidades'}`;
      }

      message += `• *${p.name}* - ${qtyStr} (S/ ${lineTotal(p, qty).toFixed(2)})\n`;
    });

    message += `\n*Subtotal:* S/ ${cartTotal.toFixed(2)}\n\n`;
    message += `Puedes ver el detalle de mi selección aquí:\n${url}`;

    const getCleanWhatsAppNumber = (branch: any) => {
      let rawNum = branch?.configuracion?.contacto?.telefono ||
                   branch?.configuracion?.redes_sociales?.whatsapp ||
                   branch?.telefono ||
                   branch?.phone ||
                   '946303481';
      if (!rawNum) return '51946303481';
      if (rawNum.includes('wa.me/') || rawNum.includes('phone=')) {
        const match = rawNum.match(/(?:wa\.me\/|phone=)(\d+)/);
        if (match && match[1]) return match[1];
      }
      let digits = rawNum.replace(/\D/g, '');
      if (digits.length === 9) {
        digits = '51' + digits;
      }
      return digits || '51946303481';
    };

    const waNumber = getCleanWhatsAppNumber(selectedBranch);
    const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const saveClientData = async () => {
    if (!clientData.name && !clientData.dni) return;
    setIsSavingClient(true);
    try {
      const branchId = selectedBranch?.id || 'branch';
      const customerIdentifier = clientData.dni.trim() || clientData.name.trim().toLowerCase().replace(/\s+/g, '_');
      const docId = `${branchId}_${customerIdentifier}`;

      await setDoc(doc(db, "customers", docId), {
        branchId: selectedBranch?.id || null,
        customerName: clientData.name,
        customerDNI: clientData.dni,
        phone: clientData.phone,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setIsClientFormOpen(false);
    } catch (e) {
      console.error("Error saving client:", e);
    } finally {
      setIsSavingClient(false);
    }
  };

  // Auto-load shared selections from URL on mount/products load
  useEffect(() => {
    if (products.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const cartParam = params.get('cart');
      if (cartParam) {
        const loadedCart: Record<string, { product: any; qty: number }> = {};
        let items: { name: string; qty: number; id?: string; price?: number }[] = [];

        if (cartParam.includes(':') || cartParam.startsWith('[')) {
          // New human-readable format: "Name:Qty,Name:Qty"
          const parts = cartParam.split(',');
          parts.forEach(part => {
            const index = part.lastIndexOf(':');
            if (index !== -1) {
              const name = decodeURIComponent(part.substring(0, index)).trim();
              const qty = parseInt(part.substring(index + 1)) || 1;
              if (name) items.push({ name, qty });
            }
          });
        } else {
          // Fallback to old base64 format for backward compatibility
          try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(cartParam))));
            if (Array.isArray(decoded)) {
              items = decoded.map(item => ({
                id: item.id,
                name: item.n,
                qty: item.q,
                price: item.p
              }));
            }
          } catch (err) {
            console.error("Failed to parse base64 cart param:", err);
          }
        }

        // Match items with Firestore products or use virtual fallback
        items.forEach(item => {
          const matchingProduct = products.find(p =>
            (item.id && p.id === item.id) ||
            p.name?.toLowerCase().trim() === item.name.toLowerCase().trim()
          );

          if (matchingProduct) {
            loadedCart[matchingProduct.id] = {
              product: matchingProduct,
              qty: item.qty
            };
          } else {
            // Create a virtual placeholder product from name so the user can see it in the cart!
            const virtualProduct = {
              id: item.id || `virtual-${Math.random()}`,
              name: item.name,
              price: item.price || 0,
              currentStock: item.qty,
              minStock: 0,
              category: 'Compartido',
              brand: 'Importado',
              imageUrl: '',
              images: []
            };
            loadedCart[virtualProduct.id] = {
              product: virtualProduct,
              qty: item.qty
            };
          }
        });

        if (Object.keys(loadedCart).length > 0) {
          setSharedCart(loadedCart);
        }
      }
    } catch (e) {
      console.error("Failed to parse shared cart URL:", e);
    }
  }, [products]);

  // Preload branch logo to avoid flash of raw alt text
  useEffect(() => {
    if (!selectedBranch) {
      setLogoReady(true);
      return;
    }
    const logoUrl = branchLogoUrl(selectedBranch);
    if (!logoUrl || logoUrl === readyLogoRef.current) {
      setLogoReady(true);
      return;
    }
    setLogoReady(false);
    const img = new Image();
    img.src = logoUrl;
    const done = () => { readyLogoRef.current = logoUrl; setLogoReady(true); };
    img.onload = done;
    img.onerror = done; // fall back to loader exit if error
  }, [selectedBranch]);

  const isAppLoading = loading || !logoReady;

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Dynamic Title and Favicon
  useEffect(() => {
    if (!selectedBranch) return;
    document.title = selectedBranch.name ? `${selectedBranch.name} — Catálogo` : 'Catálogo | Dechy';
    const href = selectedBranch?.configuracion?.logo || '/img/logodechy.png';
    const links = document.querySelectorAll("link[rel~='icon']");
    if (links.length === 0) {
      const link = document.createElement('link');
      link.rel = 'icon'; link.href = href;
      document.head.appendChild(link);
    } else {
      links.forEach(l => { (l as HTMLLinkElement).href = href; });
    }
  }, [selectedBranch]);

  // Fetch branches (live). One catalog deployment serves every company: the visited
  // domain picks the company. Unassigned domains (localhost, previews, the main domain)
  // show the company marked "catálogo principal"; ?branch=<id> only applies there.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branches"), snap => {
      const data: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const host = window.location.hostname.toLowerCase().replace(/^www\./, '');
      const branchParam = new URLSearchParams(window.location.search).get('branch');
      const found = data.find(b => b.catalogDomain && b.catalogDomain === host)
        || data.find(b => b.id === branchParam)
        || data.find(b => b.catalogFeatured)
        || data[0];

      if (found) {
        setSelectedBranch((prev: any) => (prev && prev.id === found.id && JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
      } else {
        setLoading(false);
      }
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Fetch categories
  useEffect(() => {
    const q = query(collection(db, "categories"));
    const unsub = onSnapshot(q, (snap) => {
      const cats: any[] = [];
      snap.forEach(doc => {
        cats.push({ id: doc.id, ...doc.data() });
      });
      setDbCategories(cats);
    }, (err) => console.error("Error fetching categories:", err));
    return () => unsub();
  }, []);

  // Fetch products: Dechy's own inventory is the sole source of truth,
  // optionally overridden per branch by branchCatalogProducts (catalog-specific pricing).
  const productsBranchRef = useRef<string | null>(snapshot?.branch?.id ?? null);
  const liveProductsLoadedRef = useRef(false);
  useEffect(() => {
    if (!selectedBranch) return;
    if (productsBranchRef.current !== selectedBranch.id) setLoading(true);

    let baseProducts: any[] = [];
    let branchLinks: any[] = [];
    let baseLoaded = false;
    let linksLoaded = false;

    const updateCombinedProducts = () => {
      if (!baseLoaded || !linksLoaded) return;
      const linksMap = new Map<string, any>(branchLinks.map(l => [l.catalogProductId || l.productId, l]));

      const combined = baseProducts
        .map(p => decorateCatalogProduct(p, linksMap.get(p.id)))
        .filter(p => isCatalogProductVisible(p) && p.currentStock > 0);
      productsBranchRef.current = selectedBranch.id;
      liveProductsLoadedRef.current = true;
      setProducts(combined);
      setLoading(false);
    };

    // Listen to Dechy's own products for this branch
    const qBase = query(collection(db, "products"), where("branch", "==", selectedBranch.id));
    const unsubBase = onSnapshot(qBase, (snap) => {
      baseProducts = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => !p.catalogHidden);
      baseLoaded = true;
      updateCombinedProducts();
    }, (err) => {
      console.error("Error fetching Dechy products:", err);
      baseLoaded = true;
      updateCombinedProducts();
    });

    // Listen to Dechy branch catalog pricing overrides
    const qLinks = query(collection(db, "branchCatalogProducts"), where("branchId", "==", selectedBranch.id));
    const unsubLinks = onSnapshot(qLinks, (snap) => {
      branchLinks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      linksLoaded = true;
      updateCombinedProducts();
    }, (err) => {
      console.error("Error fetching Dechy branch links:", err);
      linksLoaded = true;
      updateCombinedProducts();
    });

    return () => {
      unsubBase();
      unsubLinks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch?.id]);

  // Refresh the local snapshot whenever live data settles
  useEffect(() => {
    if (loading || !selectedBranch || products.length === 0) return;
    const t = setTimeout(() => writeSnapshot({ branch: selectedBranch, products, categories: dbCategories }), 600);
    return () => clearTimeout(t);
  }, [loading, selectedBranch, products, dbCategories]);

  // Deep-link: printed labels' QR codes and catalog cards (opened in a new tab)
  // point here with ?producto=<slug-or-id> (and ?branch=<id>, handled by the
  // branch-fetch effect above). Back/forward between products keeps working.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (products.length === 0) return;
    const syncFromUrl = () => {
      const productParam = new URLSearchParams(window.location.search).get('producto');
      const match = productParam ? products.find(p => p.slug === productParam || String(p.id) === productParam) : null;
      setSelectedProduct(match || null);
      setPendingProductParam(null);
      if (match) setActiveTab('catalogo');
    };
    if (!deepLinkHandled.current) {
      // A product missing from the cached snapshot may be new: wait for live data before giving up
      const productParam = new URLSearchParams(window.location.search).get('producto');
      const inList = productParam && products.some(p => p.slug === productParam || String(p.id) === productParam);
      if (productParam && !inList && !liveProductsLoadedRef.current) return;
      deepLinkHandled.current = true;
      syncFromUrl();
    }
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [products]);

  // Leaving the product page drops ?producto so a reload doesn't reopen it
  // (only on an actual product → no-product transition, never while the link resolves)
  const prevSelectedRef = useRef<any>(null);
  useEffect(() => {
    const wasOnProduct = prevSelectedRef.current !== null;
    prevSelectedRef.current = selectedProduct;
    if (selectedProduct || !wasOnProduct) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('producto')) return;
    params.delete('producto');
    window.history.replaceState({}, '', window.location.pathname + (params.toString() ? `?${params}` : ''));
  }, [selectedProduct]);

  const productUrl = (p: any) => {
    const qs = new URLSearchParams();
    const branchParam = new URLSearchParams(window.location.search).get('branch');
    if (branchParam) qs.set('branch', branchParam);
    qs.set('producto', p.slug || p.id);
    return `${window.location.pathname}?${qs}`;
  };
  // Catalog cards open the product page in a new browser tab
  const openProductInNewTab = (p: any) => {
    if (selectedBranch && products.length > 0) writeSnapshot({ branch: selectedBranch, products, categories: dbCategories });
    window.open(productUrl(p), '_blank', 'noopener');
  };
  // Links inside the product page (recommended, accessories) stay in the same tab
  const openProductHere = (p: any) => {
    window.history.pushState({}, '', productUrl(p));
    setSelectedProduct(p);
    setActiveTab('catalogo');
    window.scrollTo({ top: 0 });
  };

  // The selection lives in localStorage (per company) so the catalog tab and every
  // product tab share it: adding from a product tab shows up in the catalog tab too
  const cartKey = selectedBranch ? `catalog-cart:${selectedBranch.id}` : null;
  const cartHydrated = useRef(false);
  const readStoredCart = (): Record<string, { product: any; qty: number }> => {
    const next: Record<string, { product: any; qty: number }> = {};
    try {
      const stored = JSON.parse(localStorage.getItem(cartKey || '') || '{}') as Record<string, number>;
      Object.entries(stored).forEach(([id, qty]) => {
        const product = products.find(p => p.id === id);
        if (product && qty > 0) next[id] = { product, qty };
      });
    } catch { /* storage unavailable or corrupt: start empty */ }
    return next;
  };
  useEffect(() => {
    if (!cartKey || products.length === 0 || cartHydrated.current) return;
    cartHydrated.current = true;
    setCart(prev => ({ ...readStoredCart(), ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, products]);
  useEffect(() => {
    if (!cartKey || !cartHydrated.current) return;
    try {
      localStorage.setItem(cartKey, JSON.stringify(Object.fromEntries(Object.entries(cart).map(([id, v]) => [id, v.qty]))));
    } catch { /* storage unavailable: selection stays in this tab only */ }
  }, [cart, cartKey]);
  useEffect(() => {
    if (!cartKey) return;
    const onStorage = (e: StorageEvent) => { if (e.key === cartKey) setCart(readStoredCart()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, products]);

  // Product tab title
  useEffect(() => {
    if (selectedProduct) document.title = `${selectedProduct.name} — ${selectedBranch?.name || 'Catálogo'}`;
    else if (selectedBranch?.name) document.title = `${selectedBranch.name} — Catálogo`;
  }, [selectedProduct, selectedBranch]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) {
        if (onlyInStock && p.currentStock <= 0) return;
        cats.add(p.category);
      }
    });
    return Array.from(cats).sort();
  }, [products, onlyInStock]);

  // Sidebar taxonomy: parent + child categories from the system's category
  // manager (Firestore `categories` collection) plus any legacy/ad-hoc category
  // names that only exist as raw strings on products. Entries without visible
  // products are left out so the catalog never lists an empty category.
  const categoriesWithSubcategories = useMemo(() => {
    const dbRoots = dbCategories.filter(c => !c.parentId);
    const dbRootNames = new Set(dbRoots.map(c => (c.name || '').toLowerCase().trim()));

    const dbSubcategoriesMap = new Map<string, any[]>();
    dbCategories.forEach(c => {
      if (c.parentId) {
        const list = dbSubcategoriesMap.get(c.parentId) || [];
        list.push(c);
        dbSubcategoriesMap.set(c.parentId, list);
      }
    });

    const fromSystem = dbRoots.map(root => ({
      id: root.id,
      name: root.name,
      subcategories: (dbSubcategoriesMap.get(root.id) || []).map(s => ({ id: s.id, name: s.name }))
    }));

    // Product categories that were never created in the category manager
    const productOnlyNames = new Set<string>();
    products.forEach(p => {
      if (p.category && !dbRootNames.has(p.category.toLowerCase().trim())) {
        productOnlyNames.add(p.category);
      }
    });

    const fromProductsOnly = Array.from(productOnlyNames).sort().map(catName => {
      const normalizedName = catName.toLowerCase().trim();
      const subNames = new Set<string>();
      products.forEach(p => {
        if (p.category && p.category.toLowerCase().trim() === normalizedName && p.subcategory) {
          subNames.add(p.subcategory);
        }
      });
      return {
        id: `name:${catName}`,
        name: catName,
        subcategories: Array.from(subNames).sort().map(sName => ({ id: `name:${sName}`, name: sName }))
      };
    });

    // Hide categories/subcategories that would show zero products — same matching
    // rules (and stock switch) as filteredProducts, so a listed entry is never empty
    const norm = (v: any) => String(v || '').toLowerCase().trim();
    const visibleProducts = onlyInStock ? products.filter(p => p.currentStock > 0) : products;
    const subHasProducts = (catProducts: any[], sub: { id: string; name: string }) =>
      catProducts.some(p => sub.id.startsWith('name:')
        ? norm(p.subcategory) === norm(sub.name)
        : p.subcategoryId === sub.id || norm(p.subcategory) === norm(sub.id) || norm(p.subcategory) === norm(sub.name));

    // Duplicate names in the category manager (e.g. two "SALA" roots) match the same
    // products, so merge them into one entry with the union of their subcategories
    const byName = new Map<string, { id: string; name: string; subcategories: { id: string; name: string }[] }>();
    [...fromSystem, ...fromProductsOnly].forEach(cat => {
      const existing = byName.get(norm(cat.name));
      if (!existing) {
        byName.set(norm(cat.name), { ...cat, subcategories: [...cat.subcategories] });
        return;
      }
      cat.subcategories.forEach(sub => {
        if (!existing.subcategories.some(s => norm(s.name) === norm(sub.name))) existing.subcategories.push(sub);
      });
    });

    return Array.from(byName.values())
      .map(cat => {
        const catProducts = visibleProducts.filter(p => norm(p.category) === norm(cat.name));
        return catProducts.length === 0
          ? null
          : { ...cat, subcategories: cat.subcategories.filter(sub => subHasProducts(catProducts, sub)) };
      })
      .filter((cat): cat is NonNullable<typeof cat> => cat !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dbCategories, products, onlyInStock]);

  const selectedSubcategoryName = useMemo(() => {
    if (!selectedSubcategory) return null;
    if (selectedSubcategory.startsWith('name:')) {
      return selectedSubcategory.replace('name:', '');
    }
    for (const cat of categoriesWithSubcategories) {
      const sub = cat.subcategories.find(s => s.id === selectedSubcategory);
      if (sub) return sub.name;
    }
    return selectedSubcategory;
  }, [selectedSubcategory, categoriesWithSubcategories]);

  const categoryCircles = useMemo(() => {
    return categories.map(cat => {
      const customImg = selectedBranch?.configuracion?.categoriaImagenes?.[cat] || selectedBranch?.configuracion?.categoriaImagenes?.[cat.toLowerCase()];
      const pWithImg = products.find(p => p.category === cat && p.images && p.images.length > 0 && (!onlyInStock || p.currentStock > 0));
      const img = customImg || pWithImg?.images?.[0] || products.find(p => p.category === cat && (!onlyInStock || p.currentStock > 0))?.imageUrl || '/img/hero_lifestyle_bg.png';
      return { name: cat, img };
    });
  }, [categories, products, selectedBranch, onlyInStock]);

  // Hero-embedded category carousel (uses the same category images as the circles below)
  const heroCatTotal = categoryCircles.length;
  const heroCatA = heroCatTotal > 0 ? categoryCircles[heroCatIndex % heroCatTotal] : null;
  const heroCatB = heroCatTotal > 1 ? categoryCircles[(heroCatIndex + 1) % heroCatTotal] : null;
  const heroCatPrev = () => setHeroCatIndex(i => (i - 1 + heroCatTotal) % heroCatTotal);
  const heroCatNext = () => setHeroCatIndex(i => (i + 1) % heroCatTotal);
  const goToCategoryFromHero = (catName: string) => {
    setSelectedCategory(catName);
    setActiveTab('catalogo');
    setTimeout(() => {
      const sec = document.getElementById(`section-${catName.replace(/\s+/g, '-')}`);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };


  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Filter by Category (case/whitespace-insensitive: the sidebar now lists
    // categories from the admin's category manager, which may differ in
    // casing from the raw string stored on older products)
    if (selectedCategory !== 'Todos') {
      const normalizedCategory = selectedCategory.toLowerCase().trim();
      list = list.filter(p => (p.category || '').toLowerCase().trim() === normalizedCategory);

      // Filter by Subcategory if selected
      if (selectedSubcategory) {
        if (selectedSubcategory.startsWith('name:')) {
          const subName = selectedSubcategory.replace('name:', '').toLowerCase().trim();
          list = list.filter(p => (p.subcategory || '').toLowerCase().trim() === subName);
        } else {
          list = list.filter(p => p.subcategoryId === selectedSubcategory || (p.subcategory || '').toLowerCase().trim() === selectedSubcategory.toLowerCase().trim());
        }
      }
    }

    // Filter by Stock switch
    if (onlyInStock) {
      list = list.filter(p => p.currentStock > 0);
    }

    // Filter by Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'priceAsc') {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'priceDesc') {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [products, selectedCategory, selectedSubcategory, onlyInStock, searchQuery, sortBy]);

  // Catalog grid pagination (4 x 4 per page)
  const CATALOG_PAGE_SIZE = 16;
  const [catalogPage, setCatalogPage] = useState(1);
  const totalCatalogPages = Math.max(1, Math.ceil(filteredProducts.length / CATALOG_PAGE_SIZE));
  const pagedProducts = filteredProducts.slice((catalogPage - 1) * CATALOG_PAGE_SIZE, catalogPage * CATALOG_PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    const from = Math.max(1, Math.min(catalogPage - 3, totalCatalogPages - 6));
    const to = Math.min(totalCatalogPages, from + 6);
    return Array.from({ length: to - from + 1 }, (_, k) => from + k);
  }, [catalogPage, totalCatalogPages]);
  const goToCatalogPage = (page: number) => {
    setCatalogPage(Math.min(Math.max(1, page), totalCatalogPages));
    scrollSmoothWithOffset('catalog-main', 110);
  };
  // Any filter change starts again from the first page
  useEffect(() => { setCatalogPage(1); }, [selectedCategory, selectedSubcategory, searchQuery, sortBy, onlyInStock]);

  const productsByCategory = useMemo(() => {
    const g: Record<string, any[]> = {};
    categories.forEach(c => g[c] = []);
    products.forEach(p => {
      if (p.category && g[p.category]) {
        if (onlyInStock && p.currentStock <= 0) return;
        g[p.category].push(p);
      }
    });
    return g;
  }, [products, categories, onlyInStock]);

  // ScrollSpy
  useEffect(() => {
    if (searchQuery || activeTab !== 'catalogo') return;
    const obs = new IntersectionObserver((entries) => {
      if (isClickScrollingRef.current) return;
      entries.forEach(e => {
        if (e.isIntersecting) {
          const cat = e.target.getAttribute('data-category-section');
          if (cat) {
            setSelectedCategory(cat);
            document.getElementById(`tab-${cat.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
          }
        }
      });
    }, { rootMargin: '-120px 0px -70% 0px' });
    setTimeout(() => {
      document.querySelectorAll('[data-category-section]').forEach(s => obs.observe(s));
    }, 500);
    return () => obs.disconnect();
  }, [categories, products, searchQuery, activeTab]);

  // Top products carousel (only products in stock on Inicio tab)
  const topProducts = useMemo(() => {
    const inStock = products.filter(p => p.currentStock > 0);
    const withImg = inStock.filter(p => p.images && p.images.length > 0);
    return withImg.length >= 3 ? withImg.slice(0, 8) : inStock.slice(0, 8);
  }, [products]);

  // Dynamic Inspiration Images fallback sequence
  const inspirationImages = useMemo(() => {
    const customImgs = selectedBranch?.configuracion?.inspiracion?.imagenes || [];
    const list = [...customImgs];
    const prodsWithImg = products.filter(p => p.images && p.images.length > 0);
    for (let i = 0; i < 4; i++) {
      if (!list[i]) {
        list[i] = prodsWithImg[i]?.images?.[0] || prodsWithImg[i]?.imageUrl || '/img/hero_lifestyle_bg.png';
      }
    }
    return list;
  }, [products, selectedBranch]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setVisibleCount(2);
      else if (window.innerWidth < 1024) setVisibleCount(3);
      else setVisibleCount(4);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const canSlide = topProducts.length > visibleCount;

  useEffect(() => {
    if (topProducts.length > 0) {
      setSlideIndex(canSlide ? topProducts.length : 0);
    }
  }, [topProducts, canSlide]);

  useEffect(() => {
    if (!canSlide) return;
    const iv = setInterval(() => {
      setIsTransitioning(true);
      setSlideIndex(prev => prev + 1);
    }, 6000);
    return () => clearInterval(iv);
  }, [canSlide]);

  const handleNextSlide = () => {
    setIsTransitioning(true);
    setSlideIndex(prev => prev + 1);
  };

  const handlePrevSlide = () => {
    setIsTransitioning(true);
    setSlideIndex(prev => prev - 1);
  };

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (slideIndex >= topProducts.length * 2) {
      setIsTransitioning(false);
      setSlideIndex(slideIndex - topProducts.length);
    } else if (slideIndex < topProducts.length) {
      setIsTransitioning(false);
      setSlideIndex(slideIndex + topProducts.length);
    }
  };

  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY <= 80) {
        setShowHeader(true);
      } else {
        // Hysteresis: Only hide if scrolled down by > 15px, show if scrolled up by > 15px
        if (delta > 15) {
          setShowHeader(false);
        } else if (delta < -15) {
          setShowHeader(true);
        }
      }

      if (Math.abs(delta) > 5) {
        setLastScrollY(currentScrollY);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const scrollSmoothWithOffset = (id: string, offset = 180) => {
    const el = document.getElementById(id);
    if (el) {
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const featuredProduct = topProducts[featuredIndex] || topProducts[0] || products[0];
  const featuredImages = useMemo(() => {
    if (!featuredProduct) return [];
    const raw = featuredProduct.images?.length ? featuredProduct.images : (featuredProduct.imageUrl ? [featuredProduct.imageUrl] : []);
    return raw.map((i: any) => typeof i === 'string' ? i : i.url).filter(Boolean);
  }, [featuredProduct]);

  const primaryColor = selectedBranch?.configuracion?.colores?.primario || '#1e293b';
  const secondaryColor = selectedBranch?.configuracion?.colores?.secundario || '#334155';
  const branchLogo = selectedBranch?.configuracion?.logo;
  const branchLogoWhite = selectedBranch?.configuracion?.logoBlanco;
  // On the landing the navbar is transparent over the hero photo (white text + white logo);
  // everywhere else it is solid white with dark text
  const navOverlay = activeTab === 'inicio' && !selectedProduct && !pendingProductParam && !sharedCart;
  const navLogo = (navOverlay || theme === 'dark') ? (branchLogoWhite || branchLogo) : branchLogo;
  const navLinkClass = (active: boolean) =>
    `font-display text-[17px] tracking-wide transition-colors duration-300 relative py-1 outline-none focus-visible:ring-2 focus-visible:ring-current/40 rounded-sm after:absolute after:-bottom-1 after:left-0 after:w-full after:h-[2px] after:bg-current after:transition-transform after:duration-300 after:origin-left ${active ? 'after:scale-x-100' : `after:scale-x-0 hover:after:scale-x-100 ${navOverlay ? 'hover:text-white' : 'hover:text-slate-950 dark:hover:text-white'}`}`;
  const navActiveColor = (active: boolean) => (active && !navOverlay ? primaryColor : undefined);
  const goToTab = (tab: 'inicio' | 'catalogo' | 'nosotros') => {
    setSelectedProduct(null);
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'catalogo') setTimeout(() => scrollSmoothWithOffset('catalog-main'), 100);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white font-sans selection:bg-slate-900 selection:text-white dark:selection:bg-white dark:selection:text-slate-950">

      {/* ── Top Promo Ticker ── */}
      <div
        className="text-white text-[10px] sm:text-xs font-semibold py-2 px-4 flex items-center justify-between sm:justify-center gap-6 z-[60] relative tracking-wider uppercase"
        style={{ backgroundColor: primaryColor }}
      >
        <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-amber-250" /> Envíos a todo el país</span>
        <span className="hidden sm:flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-amber-250" /> Asesoría personalizada</span>
        <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-amber-250" /> Catálogo de muestras</span>
      </div>

      {/* ── Navbar: transparent over the landing photo, solid white elsewhere ── */}
      <nav
        className={`sticky top-0 left-0 w-full z-50 h-16 sm:h-20 px-4 sm:px-6 border-b transition-[transform,background-color,border-color,box-shadow] duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'} ${navOverlay ? 'bg-transparent border-transparent shadow-none' : 'bg-white dark:bg-[#09090b] border-slate-200 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'}`}
      >
        <div className="max-w-7xl h-full mx-auto flex items-center justify-between gap-3 sm:gap-6">

          {/* Company logo */}
          <button
            onClick={() => { setSelectedProduct(null); setActiveTab('inicio'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2 shrink-0 transition-transform duration-300 hover:scale-[1.03]"
            aria-label={selectedBranch?.name || 'Inicio'}
          >
            {navLogo ? (
              <img src={navLogo} alt={selectedBranch?.name || ''} className="h-9 sm:h-12 w-auto max-w-[140px] sm:max-w-[190px] object-contain" />
            ) : (
              <span className={`font-display text-xl sm:text-2xl truncate max-w-[160px] sm:max-w-none ${navOverlay ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {selectedBranch?.name || ''}
              </span>
            )}
          </button>

          {/* Middle Nav Links */}
          <div className={`hidden md:flex items-center gap-9 transition-colors duration-300 ${navOverlay ? 'text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]' : 'text-slate-800 dark:text-slate-300'}`}>
            <button
              onClick={() => { setSelectedProduct(null); setActiveTab('inicio'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={navLinkClass(activeTab === 'inicio')}
              style={{ color: navActiveColor(activeTab === 'inicio') }}
            >
              Inicio
            </button>
            <button
              onClick={() => { setSelectedProduct(null); setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main'), 100); }}
              className={navLinkClass(activeTab === 'catalogo')}
              style={{ color: navActiveColor(activeTab === 'catalogo') }}
            >
              Catálogo
            </button>
            <button
              onClick={() => { setSelectedProduct(null); setActiveTab('nosotros'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={navLinkClass(activeTab === 'nosotros')}
              style={{ color: navActiveColor(activeTab === 'nosotros') }}
            >
              Nosotros
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="relative hidden sm:block w-40 lg:w-48">
              <Search className={`absolute z-10 left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${navOverlay ? 'text-white/80' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (e.target.value) { setSelectedProduct(null); setActiveTab('catalogo'); } }}
                placeholder="Buscar..."
                className={`w-full pl-9 pr-3 py-2 border-none rounded-full text-xs font-medium outline-none focus:ring-2 transition-colors ${navOverlay ? 'bg-white/15 text-white placeholder:text-white/75 focus:ring-white/40 backdrop-blur-sm' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-950 dark:text-white placeholder:text-slate-400 focus:ring-slate-300/60'}`}
              />
            </div>

            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-full transition-colors ${navOverlay ? 'text-white hover:bg-white/15' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white'}`}>
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button onClick={() => setCartOpen(true)} className={`relative p-2 rounded-full transition-colors ${navOverlay ? 'text-white hover:bg-white/15' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[8px] font-bold text-white rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>{cartCount}</span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              className={`md:hidden p-2 rounded-full transition-colors ${navOverlay ? 'text-white hover:bg-white/15' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 dark:text-slate-300'}`}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="md:hidden fixed inset-0 z-[55] bg-slate-950/40 backdrop-blur-[2px]" />
            <motion.div
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}
              className="md:hidden fixed top-16 inset-x-0 z-[56] mx-3 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200 dark:ring-white/10 p-4 space-y-3"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); if (e.target.value) { setSelectedProduct(null); setActiveTab('catalogo'); } }}
                  onKeyDown={e => { if (e.key === 'Enter') goToTab('catalogo'); }}
                  placeholder="Buscar productos..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col">
                {([['inicio', 'Inicio'], ['catalogo', 'Catálogo'], ['nosotros', 'Nosotros']] as const).map(([tab, label]) => {
                  const active = activeTab === tab && !selectedProduct;
                  return (
                    <button
                      key={tab}
                      onClick={() => goToTab(tab)}
                      className={`text-left font-display text-[18px] px-3 py-3 rounded-xl transition-colors ${active ? 'bg-slate-100 dark:bg-white/5' : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                      style={{ color: active ? primaryColor : undefined }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Loading ── */}
      <AnimatePresence>
        {isAppLoading && !pendingProductParam && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md">
            {branchLogo && logoReady ? (
              <motion.img animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.5 }} src={branchLogo} alt="" className="w-16 h-16 object-contain mb-4" />
            ) : (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-[3px] border-slate-200 rounded-full mb-4" style={{ borderTopColor: primaryColor }} />
            )}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cargando espacios...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {sharedCart ? (
        <SharedCartView
          sharedCart={sharedCart}
          onClose={() => {
            const params = new URLSearchParams(window.location.search);
            params.delete('cart');
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState({}, document.title, newUrl);
            setSharedCart(null);
          }}
          onImport={() => {
            const params = new URLSearchParams(window.location.search);
            const cartParam = params.get('cart');
            const clientName = params.get('clientName') || '';
            const clientDNI = params.get('clientDNI') || '';
            const clientPhone = params.get('clientPhone') || '';

            if (cartParam) {
              const qs = new URLSearchParams();
              qs.set('importCart', cartParam);
              if (clientName) qs.set('clientName', clientName);
              if (clientDNI) qs.set('clientDNI', clientDNI);
              if (clientPhone) qs.set('clientPhone', clientPhone);

              window.location.href = `https://jieda.vercel.app/ventas?${qs.toString()}`;
            }
          }}
          primaryColor={primaryColor}
          selectedBranch={selectedBranch}
          theme={theme}
        />
      ) : pendingProductParam && !selectedProduct ? (
        <div className="bg-[#f7f7f7] dark:bg-[#0c0c0e] min-h-[80vh]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-10 lg:gap-14 animate-pulse">
            <div className="flex gap-4">
              <div className="hidden sm:flex flex-col gap-3">{[0, 1, 2].map(i => <div key={i} className="w-[66px] h-[66px] bg-slate-200 dark:bg-slate-800" />)}</div>
              <div className="flex-1 aspect-square bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10" />
            </div>
            <div className="space-y-5 pt-2">
              <div className="h-9 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="flex gap-4 pt-4">{[0, 1, 2].map(i => <div key={i} className="w-[82px] h-[82px] rounded-full bg-slate-200 dark:bg-slate-800" />)}</div>
              <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded mt-6" />
              <div className="grid grid-cols-2 gap-4 pt-6"><div className="h-12 rounded-full bg-slate-200 dark:bg-slate-800" /><div className="h-12 rounded-full bg-slate-300 dark:bg-slate-700" /></div>
            </div>
          </div>
        </div>
      ) : selectedProduct ? (
        <ProductDetail
          product={products.find(p => p.id === selectedProduct.id) || selectedProduct}
          products={products}
          categories={categoriesWithSubcategories}
          primaryColor={primaryColor}
          cartQty={cart[selectedProduct.id]?.qty || 0}
          onSetCartQty={qty => updateCartQty(selectedProduct.id, qty, selectedProduct)}
          onOpenCart={() => setCartOpen(true)}
          onOpenProduct={openProductHere}
          onGoHome={() => { setSelectedProduct(null); setActiveTab('inicio'); window.scrollTo({ top: 0 }); }}
          onGoToCatalog={(category, subcategoryId) => {
            if (category && subcategoryId) handleSelectSubcategory(category, subcategoryId);
            else handleSelectCategory(category || 'Todos');
            setSelectedProduct(null);
            setActiveTab('catalogo');
            setTimeout(() => scrollSmoothWithOffset('catalog-main', 110), 100);
          }}
        />
      ) : activeTab === 'inicio' ? (
        <>
          {/* ══════════════════════════════════════
               SECTION 1 — Breathtaking Lifestyle Hero
               Playfair Serif font & Luxury styling
               The landing is this single screen: no sections below, no scroll.
             ══════════════════════════════════════ */}
          <section ref={heroRef} className="relative min-h-[calc(100svh-2rem)] -mt-16 sm:-mt-20 overflow-hidden flex">
            {/* Background Image — covers the entire hero, left side stays completely clean */}
            <div className="absolute inset-0 z-0">
              <img
                src={selectedBranch?.configuracion?.bannerHero || '/img/hero_lifestyle_bg.png'}
                alt="Luxury contemporary living room panels and SPC floor"
                className="w-full h-full object-cover object-center scale-[1.01]"
              />
              {/* Top fade so the transparent navbar stays legible */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
              {/* Right-side fade behind the text/carousel column only — left half stays untouched */}
              <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(to left, rgba(8,7,5,0.85) 0%, rgba(8,7,5,0.55) 32%, rgba(8,7,5,0) 60%)' }} />
              {/* Phones: the text column covers the whole photo, so darken it evenly */}
              <div className="absolute inset-0 md:hidden bg-gradient-to-t from-black/85 via-black/55 to-black/40" />
            </div>

            {/* All hero content lives in a right-anchored column — the left half of the photo has nothing on it */}
            <div className="relative z-10 w-full flex">
              <div className="ml-auto w-full md:max-w-[560px] flex flex-col justify-between gap-8 pt-24 sm:pt-32 pb-8 px-5 sm:px-8 md:pr-10 text-white">

                {/* Top: headline */}
                <div className="space-y-5">
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-[9px] sm:text-[10px] font-bold tracking-[0.3em] uppercase text-amber-200/90 block"
                  >
                    Transforma tus espacios
                  </motion.span>

                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className="font-display text-[34px] sm:text-[46px] tracking-wide leading-[1.1] font-normal text-white"
                  >
                    Materiales que <br />
                    <span
                      className="bg-gradient-to-r from-amber-100 to-amber-250 bg-clip-text text-transparent"
                      style={{
                        backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor || primaryColor})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      inspiran diseño
                    </span>
                  </motion.h1>

                </div>

                {/* Bottom: description sits directly above the embedded category carousel */}
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="space-y-1.5"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 block">Nuestras líneas</span>
                    <p className="text-xs sm:text-sm text-slate-200 font-light leading-relaxed line-clamp-3">
                      {selectedBranch?.configuracion?.descripcion || 'Wall Panels, SPC laminados, Placas UV de mármol y las mejores soluciones decorativas para crear ambientes exclusivos en tu hogar o negocio.'}
                    </p>
                  </motion.div>

                  {heroCatTotal > 0 && (
                    <div>
                      <div className="flex items-center gap-3.5 mb-4">
                        <span className="text-[13px] font-extrabold tracking-wide">{String(heroCatIndex % heroCatTotal + 1).padStart(2, '0')}</span>
                        <div className="flex-1 h-px bg-white/25" />
                        <span className="text-[13px] font-semibold text-white/60 tracking-wide">{String(heroCatTotal).padStart(2, '0')}</span>
                      </div>

                      <div className="flex gap-4 overflow-hidden">
                        {[heroCatA, heroCatB].filter(Boolean).map((cat: any, idx) => (
                          <button
                            key={`${cat.name}-${idx}`}
                            onClick={() => goToCategoryFromHero(cat.name)}
                            className="w-[calc(50%-8px)] sm:w-[220px] shrink-0 rounded-[18px] sm:rounded-[22px] overflow-hidden bg-white/10 backdrop-blur-sm shadow-2xl text-left transition-transform hover:-translate-y-0.5"
                          >
                            <div className="h-[100px] sm:h-[130px] overflow-hidden">
                              <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-3 sm:p-4 space-y-1.5">
                              <h4 className="font-serif text-[14px] sm:text-[15px] font-semibold capitalize line-clamp-1">{cat.name}</h4>
                              <p className="text-[10.5px] text-white/60 font-light">
                                {(productsByCategory[cat.name]?.length || 0)} producto{(productsByCategory[cat.name]?.length || 0) === 1 ? '' : 's'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {heroCatTotal > 1 && (
                        <div className="flex gap-2.5 mt-4">
                          <button onClick={heroCatPrev} aria-label="Categoría anterior" className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors">
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={heroCatNext} aria-label="Categoría siguiente" className="w-9 h-9 rounded-full bg-white text-slate-950 flex items-center justify-center hover:bg-white/90 transition-colors">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : activeTab === 'nosotros' ? (
        <Nosotros
          primaryColor={primaryColor}
          bannerImage={selectedBranch?.configuracion?.bannerHero}
          onGoToCatalog={() => { setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main'), 100); }}
        />
      ) : (
        <>
          <div className="bg-[#f7f7f7] dark:bg-[#0c0c0e]">
            {/* ══════════════════════════════════════
                 SECTION 1 — Search header
               ══════════════════════════════════════ */}
            <section className="px-4 sm:px-6 pt-12 pb-14 sm:pt-28 sm:pb-28 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-2xl sm:text-5xl font-medium uppercase tracking-tight text-slate-950 dark:text-white"
              >
                Encuentra el producto que necesitas
              </motion.h1>
              <motion.form
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={e => { e.preventDefault(); scrollSmoothWithOffset('catalog-main', 110); }}
                className="mt-7 sm:mt-10 mx-auto max-w-xl flex items-center bg-white dark:bg-slate-900 rounded-full shadow-[0_6px_24px_-10px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/70 dark:ring-white/10 focus-within:ring-2 focus-within:ring-slate-300 transition-all"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Nombre o código del producto"
                  className="flex-1 min-w-0 bg-transparent pl-5 sm:pl-7 pr-3 py-3.5 sm:py-4 text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                <button type="submit" aria-label="Buscar" className="m-1 w-14 sm:w-20 h-11 sm:h-12 shrink-0 rounded-full bg-slate-500 hover:bg-slate-700 text-white flex items-center justify-center transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              </motion.form>
            </section>

            {/* ══════════════════════════════════════
                 SECTION 2 — Category accordion + product grid
               ══════════════════════════════════════ */}
            <main id="catalog-main" className="max-w-7xl mx-auto px-3 sm:px-6 pb-24 scroll-mt-[110px] grid lg:grid-cols-[300px_1fr] gap-10 items-start">
              <CategoryAccordion
                categories={categoriesWithSubcategories}
                selectedCategory={selectedCategory}
                selectedSubcategory={selectedSubcategory}
                onSelectCategory={handleSelectCategory}
                onSelectSubcategory={handleSelectSubcategory}
                primaryColor={primaryColor}
                resultCount={filteredProducts.length}
              />

              <div className="min-w-0">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-1 sm:px-0">
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    {searchQuery
                      ? `Resultados para "${searchQuery}" · ${filteredProducts.length}`
                      : `${selectedCategory === 'Todos' ? 'Todos los productos' : selectedCategory}${selectedSubcategoryName ? ` / ${selectedSubcategoryName}` : ''} · ${filteredProducts.length} producto${filteredProducts.length !== 1 ? 's' : ''}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOnlyInStock(!onlyInStock)}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${onlyInStock ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`}
                    >
                      {onlyInStock ? 'Solo con stock' : 'Todos'}
                    </button>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold px-3 py-1.5 rounded-full outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="default">Recomendados</option>
                      <option value="priceAsc">Menor precio</option>
                      <option value="priceDesc">Mayor precio</option>
                      <option value="alpha">Nombre (A-Z)</option>
                    </select>
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-xl">
                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm text-slate-500">No se encontraron productos con los filtros seleccionados.</p>
                  </div>
                ) : (
                  <>
                    <div key={catalogPage} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {pagedProducts.map((p, i) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 28 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: '-40px' }}
                          transition={{ duration: 0.55, delay: (i % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full"
                        >
                          <ProductCard product={p} index={i} onClick={() => openProductInNewTab(p)} onAddToCart={addToCart} onUpdateCartQty={updateCartQty} cartQty={cart[p.id]?.qty || 0} primaryColor={primaryColor} />
                        </motion.div>
                      ))}
                    </div>

                    {totalCatalogPages > 1 && (
                      <nav className="mt-10 flex flex-wrap justify-center items-center gap-1.5" aria-label="Paginación">
                        {[
                          { label: '<<', page: 1, disabled: catalogPage === 1 },
                          { label: '<', page: catalogPage - 1, disabled: catalogPage === 1 },
                          ...pageNumbers.map(n => ({ label: String(n), page: n, disabled: false })),
                          { label: '>', page: catalogPage + 1, disabled: catalogPage === totalCatalogPages },
                          { label: '>>', page: totalCatalogPages, disabled: catalogPage === totalCatalogPages },
                        ].map((b, idx) => {
                          const current = b.label === String(catalogPage);
                          return (
                            <button
                              key={`${b.label}-${idx}`}
                              onClick={() => goToCatalogPage(b.page)}
                              disabled={b.disabled}
                              className={`min-w-8 h-8 px-2 text-[12px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-default ${current ? '' : 'bg-[#bdbdbd] hover:bg-slate-500'}`}
                              style={current ? { backgroundColor: primaryColor } : undefined}
                              aria-current={current ? 'page' : undefined}
                            >
                              {b.label}
                            </button>
                          );
                        })}
                      </nav>
                    )}
                  </>
                )}
              </div>
            </main>
          </div>
        </>
      )}

      {/* ── Cart Drawer Panel (portaled to <body> so nothing on the page can cover it) ── */}
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-slate-950/40 backdrop-blur-[2px]" onClick={() => setCartOpen(false)}>
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-full max-w-[430px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col font-product"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 sm:px-7 pt-6 sm:pt-7 pb-5 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
                <div>
                  <h3 className="text-[22px] text-slate-700 dark:text-slate-100">Mi selección</h3>
                  <p className="font-label text-[12px] text-slate-400 mt-0.5">{Object.keys(cart).length} producto{Object.keys(cart).length !== 1 ? 's' : ''} · {cartCount} unidad{cartCount !== 1 ? 'es' : ''}</p>
                </div>
                <button onClick={() => setCartOpen(false)} aria-label="Cerrar" className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all duration-300 hover:rotate-90">
                  <X className="w-7 h-7" strokeWidth={1.2} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {Object.entries(cart).map(([id, { product: p, qty }]) => {
                    const upb = p.unitsPerBox && p.unitsPerBox > 1 ? p.unitsPerBox : 0;
                    const miniStepper = (label: string, value: number, onMinus: () => void, onPlus: () => void, onType: (v: number) => void) => (
                      <div className="flex items-center gap-2">
                        {label && <span className="font-label text-[10px] uppercase tracking-wider text-slate-400 w-8">{label}</span>}
                        <div className="flex items-center h-8 rounded-full ring-1 ring-slate-200 dark:ring-white/10">
                          <button onClick={onMinus} className="w-8 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"><Minus className="w-3.5 h-3.5" /></button>
                          <input
                            type="number" min="0" value={value}
                            onChange={e => onType(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-9 text-center bg-transparent outline-none text-[13px] font-bold text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button onClick={onPlus} className="w-8 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"><Plus className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                    return (
                      <motion.div
                        key={id}
                        layout
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 60, height: 0, paddingTop: 0, paddingBottom: 0 }}
                        transition={{ duration: 0.3 }}
                        className="group flex gap-4 sm:gap-5 px-5 sm:px-7 py-5 border-b border-slate-100 dark:border-white/5 overflow-hidden"
                      >
                        <button onClick={() => openProductInNewTab(p)} className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-white rounded-lg overflow-hidden" title="Ver producto">
                          {(p.imageUrl || p.images?.[0])
                            ? <img src={p.images?.[0] || p.imageUrl} alt={p.name} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" />
                            : <PackageIcon className="w-8 h-8 m-auto mt-8 text-slate-300" />}
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <button onClick={() => openProductInNewTab(p)} className="text-left text-[16px] leading-snug text-slate-950 dark:text-white hover:underline line-clamp-2">{p.name}</button>
                              <p className="text-[13px] text-slate-500 capitalize truncate">{String(p.subcategory || p.category || '').toLowerCase()}</p>
                            </div>
                            <button
                              onClick={() => updateCartQty(id, 0, p)}
                              aria-label={`Eliminar ${p.name}`}
                              title="Eliminar de mi selección"
                              className="p-1.5 -mr-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.5} />
                            </button>
                          </div>
                          <div className="flex items-end justify-between gap-3 mt-auto">
                            <div className="flex flex-col gap-1.5">
                              {upb ? (
                                <>
                                  {miniStepper('Cjs', Math.floor(qty / upb), () => updateCartQty(id, qty - upb, p), () => updateCartQty(id, qty + upb, p), v => updateCartQty(id, v * upb + (qty % upb), p))}
                                  {miniStepper('Uni', qty % upb, () => updateCartQty(id, qty - 1, p), () => updateCartQty(id, qty + 1, p), v => updateCartQty(id, Math.floor(qty / upb) * upb + v, p))}
                                </>
                              ) : (
                                miniStepper('', qty, () => updateCartQty(id, qty - 1, p), () => updateCartQty(id, qty + 1, p), v => updateCartQty(id, v, p))
                              )}
                            </div>
                            <div className="text-right">
                              <span className="block text-[15px] font-bold text-slate-950 dark:text-white whitespace-nowrap">S/ {lineTotal(p, qty).toFixed(2)}</span>
                              {boxPriceApplies(p, qty) && <span className="block font-label text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Precio de caja aplicado</span>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {cartCount === 0 && (
                  <div className="flex flex-col items-center justify-center text-center px-10 py-24 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><ShoppingBag className="w-7 h-7 text-slate-400" strokeWidth={1.5} /></div>
                    <p className="text-[15px] text-slate-500">Aún no has seleccionado ningún producto.</p>
                    <button
                      onClick={() => { setCartOpen(false); setSelectedProduct(null); setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main', 110), 100); }}
                      className="font-label text-[13px] font-semibold px-5 py-2.5 rounded-full bg-[#1f2a4d] text-white hover:bg-[#162038] transition-colors"
                    >
                      Explorar catálogo
                    </button>
                  </div>
                )}
              </div>

              {cartCount > 0 && (
                <div className="border-t border-slate-200 dark:border-white/10">
                  <div className="px-5 sm:px-7 py-3">
                    <button onClick={() => setIsClientFormOpen(!isClientFormOpen)} className="font-label text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-between w-full">
                      <span>Mis datos (opcional)</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isClientFormOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isClientFormOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="pt-3 pb-1 space-y-2">
                            <input type="text" placeholder="Nombre completo" value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} className="w-full text-[13px] px-4 py-2.5 rounded-full ring-1 ring-slate-200 dark:ring-white/10 bg-white dark:bg-slate-800 outline-none focus:ring-slate-400" />
                            <input type="text" placeholder="DNI / RUC" value={clientData.dni} onChange={e => setClientData({...clientData, dni: e.target.value})} className="w-full text-[13px] px-4 py-2.5 rounded-full ring-1 ring-slate-200 dark:ring-white/10 bg-white dark:bg-slate-800 outline-none focus:ring-slate-400" />
                            <input type="text" placeholder="Teléfono" value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} className="w-full text-[13px] px-4 py-2.5 rounded-full ring-1 ring-slate-200 dark:ring-white/10 bg-white dark:bg-slate-800 outline-none focus:ring-slate-400" />
                            <button onClick={saveClientData} disabled={isSavingClient || (!clientData.name && !clientData.dni)} className="w-full py-2.5 rounded-full bg-slate-900 text-white font-label text-[12px] font-semibold disabled:opacity-50 dark:bg-slate-700 transition-colors">
                              {isSavingClient ? 'Guardando...' : 'Guardar y asociar'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="px-5 sm:px-7 pt-3 pb-7 space-y-3 bg-[#f7f7f7] dark:bg-slate-950">
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[14px] text-slate-500">Subtotal</span>
                      <span className="text-[22px] font-bold text-slate-950 dark:text-white">S/ {cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={shareViaWhatsApp}
                      className="w-full h-12 rounded-full font-label text-[14px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                    >
                      <MessageSquare className="w-4 h-4" /> Enviar a WhatsApp
                    </button>
                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <button
                        onClick={generateShareLink}
                        className="h-11 rounded-full font-label text-[13px] font-semibold text-white bg-[#1f2a4d] hover:bg-[#162038] flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                      >
                        <Share2 className="w-4 h-4 shrink-0" /> <span className="truncate">Compartir por QR / enlace</span>
                      </button>
                      <button
                        onClick={() => { if (window.confirm('¿Vaciar toda tu selección?')) setCart({}); }}
                        className="h-11 px-4 rounded-full font-label text-[12px] font-semibold text-slate-500 ring-1 ring-slate-300 dark:ring-white/10 hover:text-rose-500 hover:ring-rose-300 transition-colors"
                      >
                        Vaciar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* ── Share QR Modal ── */}
      <AnimatePresence>
        {shareQr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShareQr('')}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">Compartir Selección</h3>
              <p className="text-[10px] text-slate-400 mb-4 font-light">Envía esta lista a un asesor por QR o copiando el enlace.</p>
              <div className="bg-white rounded-xl p-3 inline-block mb-4 border border-slate-100">
                <img src={shareQr} alt="QR Code" className="w-48 h-48" />
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className={`w-full py-2 rounded-full text-xs font-bold transition-all duration-300 ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-950'}`}
                >
                  {copied ? '¡Enlace Copiado!' : 'Copiar enlace'}
                </button>
                <button onClick={() => setShareQr('')} className="w-full py-2 rounded-full text-xs font-bold text-slate-400 hover:text-slate-650 transition-colors">Cerrar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODO REVISTA (Interactive Digital Flipbook) ── */}
      <AnimatePresence>
        {showFlipbook && (
          <FlipbookCatalog
            products={products}
            categories={categories}
            dbCategories={dbCategories}
            selectedBranch={selectedBranch}
            onClose={() => {
              closeFlipbook();
            }}
            onAddToCart={addToCart}
            primaryColor={primaryColor}
          />
        )}
      </AnimatePresence>

      {/* ── Floating Selection Shopping Bag Button ── */}
      {cartCount > 0 && (
        <button onClick={() => setCartOpen(true)} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[90] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 bg-slate-950 dark:bg-white dark:text-slate-950" style={{ boxShadow: `0 8px 24px -4px rgba(0,0,0,0.3)` }}>
          <ShoppingBag className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-5 h-5 text-[10px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950">{cartCount}</span>
        </button>
      )}

      {/* ── SECTION 6 — Footer (light, brand-first) — hidden on the single-screen landing ── */}
      {(selectedProduct || activeTab !== 'inicio') && (
      <footer className="bg-[#ebebeb] dark:bg-[#111113] text-slate-500 dark:text-slate-400 pt-14 sm:pt-20 pb-10 px-5 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 sm:gap-12">

          {/* Brand + search */}
          <div className="space-y-6 sm:col-span-2 lg:col-span-1">
            {navLogo ? (
              <img src={navLogo} alt={selectedBranch?.name || ''} className="h-20 sm:h-28 w-auto max-w-full object-contain" />
            ) : (
              <p className="font-display text-6xl" style={{ color: primaryColor }}>{selectedBranch?.name || ''}</p>
            )}
            <p className="text-[14px] leading-relaxed max-w-md">
              {selectedBranch?.configuracion?.descripcion || 'Wall Panels, SPC laminados, Placas UV de mármol y las mejores soluciones decorativas para crear ambientes exclusivos en tu hogar o negocio.'}
            </p>
            <form
              onSubmit={e => { e.preventDefault(); setSelectedProduct(null); setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main', 110), 100); }}
              className="flex items-center max-w-md bg-transparent rounded-full border-[3px] border-white dark:border-slate-700 p-1 focus-within:border-slate-300 transition-colors"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Nombre o código del producto"
                className="flex-1 min-w-0 bg-transparent pl-5 pr-2 py-2 text-xs outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
              />
              <button type="submit" aria-label="Buscar" className="w-12 h-8 rounded-full bg-[#bdbdbd] hover:bg-slate-500 text-white flex items-center justify-center transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Catalog */}
          <div className="space-y-5">
            <h4 className="text-[15px] font-extrabold uppercase text-slate-900 dark:text-white">Catálogo</h4>
            <div className="flex flex-col gap-3 text-[14px]">
              <button onClick={() => { handleSelectCategory('Todos'); setSelectedProduct(null); setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main', 110), 100); }} className="text-left hover:text-slate-900 dark:hover:text-white hover:translate-x-1 transition-all">Todos los productos</button>
              {categories.slice(0, 6).map(c => (
                <button key={c} onClick={() => { handleSelectCategory(c); setSelectedProduct(null); setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main', 110), 100); }} className="text-left capitalize hover:text-slate-900 dark:hover:text-white hover:translate-x-1 transition-all">{c}</button>
              ))}
            </div>
          </div>

          {/* Company */}
          <div className="space-y-5">
            <h4 className="text-[15px] font-extrabold uppercase text-slate-900 dark:text-white">Nosotros</h4>
            <div className="flex flex-col gap-3 text-[14px]">
              <button onClick={() => { setSelectedProduct(null); setActiveTab('nosotros'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-left hover:text-slate-900 dark:hover:text-white hover:translate-x-1 transition-all">Sobre {selectedBranch?.name || 'nosotros'}</button>
              {selectedBranch?.configuracion?.redes_sociales?.instagram && (
                <a href={selectedBranch.configuracion.redes_sociales.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white hover:translate-x-1 transition-all">Instagram</a>
              )}
              {selectedBranch?.configuracion?.redes_sociales?.facebook && (
                <a href={selectedBranch.configuracion.redes_sociales.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white hover:translate-x-1 transition-all">Facebook</a>
              )}
              {selectedBranch?.configuracion?.redes_sociales?.whatsapp && (
                <a href={selectedBranch.configuracion.redes_sociales.whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white hover:translate-x-1 transition-all">WhatsApp</a>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-5">
            <h4 className="text-[15px] font-extrabold uppercase text-slate-900 dark:text-white">Contacto</h4>
            <div className="flex flex-col gap-3 text-[14px]">
              <span className="flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 shrink-0" /> {selectedBranch?.configuracion?.contacto?.telefono || selectedBranch?.telefono || '+51 999 123 456'}</span>
              <span className="flex items-start gap-2 break-all"><Mail className="w-4 h-4 mt-0.5 shrink-0" /> {selectedBranch?.configuracion?.contacto?.correo || selectedBranch?.correo || 'hola@decordechy.pe'}</span>
              <span className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {selectedBranch?.configuracion?.contacto?.direccion || selectedBranch?.location || 'Lima, Perú'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-slate-300/70 dark:border-white/10 mt-12 sm:mt-16 pt-6 text-[12px] text-slate-400">
          © {new Date().getFullYear()} {selectedBranch?.name || 'Decor Dechy Haus'}. Todos los derechos reservados.
        </div>
      </footer>
      )}
    </div>
  );
};
