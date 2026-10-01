export const CATALOG_PRODUCT_SOURCE = "dechy";

const HIDDEN_VISIBILITY_VALUES = new Set([
  "false",
  "0",
  "hidden",
  "oculto",
  "oculta",
  "inactivo",
  "inactive",
]);

export const isCatalogProductVisible = (product: any): boolean => {
  const value = product?.visible;
  if (value === false || value === 0) return false;
  if (typeof value === "string" && HIDDEN_VISIBILITY_VALUES.has(value.trim().toLowerCase())) {
    return false;
  }
  return product?.branchCatalogEnabled !== false;
};

const COMMERCIAL_FIELDS = [
  "unitPrice",
  "price",
  "boxPrice",
  "dozenPrice",
  "costPrice",
  "wholesalePrice",
  "wholesaleThreshold",
  "wholesaleThresholdUnit",
  "salePrice",
  "discountPercent",
  "isOnSale",
  "sellByUnit",
  "sellByBox",
  "sellByDozen",
];

export const normalizeCommercialConfig = (input: any = {}): Record<string, any> => {
  const result: Record<string, any> = {};
  COMMERCIAL_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    const value = input[field];
    if (["isOnSale", "sellByUnit", "sellByBox", "sellByDozen"].includes(field)) {
      result[field] = Boolean(value);
      return;
    }
    if (field === "wholesaleThresholdUnit") {
      result[field] = value === "unidades" ? "unidades" : "cajas";
      return;
    }
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) result[field] = number;
  });
  return result;
};

// Dechy's own inventory product is already the full record (stock, price,
// description, images, brand, SKU). A branchCatalogProducts link only ever
// overrides commercial fields (e.g. a different catalog price) for a branch.
export const decorateCatalogProduct = (product: any, branchLink: any = null): any => {
  const commercial = normalizeCommercialConfig(branchLink?.commercial || {});
  const price = Number(commercial.unitPrice ?? commercial.price ?? product.unitPrice ?? product.price ?? 0);
  const currentStock = Number(product.currentStock) || 0;
  const minStock = Number(product.minStock || 0);

  // Normalize media: prefer rich imageUrls array, fall back to legacy images/imageUrl
  // Firebase Storage URLs look like: .../FILE.mp4?alt=media&token=... so $ won't match
  const isVideoUrl = (url: string) =>
    /\.(mp4|webm|ogg|mov|avi)(\?|%|$)/i.test(url);

  const toMediaItem = (item: any): { url: string; mediaType: 'image' | 'video' } | null => {
    if (typeof item === 'string') return item ? { url: item, mediaType: isVideoUrl(item) ? 'video' : 'image' } : null;
    if (item?.url) return { url: item.url, mediaType: item.mediaType === 'video' ? 'video' : (isVideoUrl(item.url) ? 'video' : 'image') };
    return null;
  };

  const buildFromUrlsArray = (arr: any[]): { url: string; mediaType: 'image' | 'video' }[] =>
    arr.map(toMediaItem).filter(Boolean) as { url: string; mediaType: 'image' | 'video' }[];

  const mediaItems: { url: string; mediaType: 'image' | 'video' }[] = (() => {
    if (product.imageUrls?.length) return buildFromUrlsArray(product.imageUrls);
    if (product.images?.length) return buildFromUrlsArray(product.images);
    if (product.imageUrl) return buildFromUrlsArray([product.imageUrl]);
    return [];
  })();

  const images: string[] = mediaItems.map(m => m.url);
  const imageUrl = images[0] || product.imageUrl || product.mainImageUrl || '';

  return {
    ...product,
    ...commercial,
    images,
    mediaItems,
    imageUrl,
    id: product.id,
    catalogProductId: product.id,
    productSource: CATALOG_PRODUCT_SOURCE,
    branchCatalogLinkId: branchLink?.id || null,
    stockManagedByDechy: true,
    branchCatalogEnabled: branchLink?.enabled !== false && isCatalogProductVisible(product),
    branchCommercialConfig: commercial,
    hasBranchCommercialConfig: Object.keys(commercial).length > 0,
    price,
    currentStock,
    minStock
  };
};

// ── Pricing shown to customers ──
// The catalog always quotes the unit price. Once an order reaches a full box
// (unitsPerBox), those units are charged at the box price and only the
// remainder keeps the unit price.
export const unitsPerBoxOf = (p: any): number =>
  Number(p?.unitsPerBox) > 1 ? Math.floor(Number(p.unitsPerBox)) : 0;

const isOnSale = (p: any): boolean =>
  Boolean(p?.isOnSale) && Number(p?.salePrice) > 0 && Number(p.salePrice) < Number(p.price);

// Explicit unit price first: `price` may be boxPrice / unitsPerBox for box-only products
const regularUnitPrice = (p: any): number =>
  Number(p?.unitPrice) > 0 ? Number(p.unitPrice) : Number(p?.price) || 0;

export const unitPriceOf = (p: any): number =>
  isOnSale(p) ? Number(p.salePrice) : regularUnitPrice(p);

export const boxPriceOf = (p: any): number => {
  const upb = unitsPerBoxOf(p);
  if (!upb || p?.sellByBox === false) return 0;
  return Number(p?.boxPrice) > 0 ? Number(p.boxPrice) : 0;
};

export const hasBoxPricing = (p: any): boolean => boxPriceOf(p) > 0;

// Unit price shown on cards and the product page
export const displayPrice = (p: any): { amount: number; regular?: number } => ({
  amount: unitPriceOf(p),
  regular: isOnSale(p) ? regularUnitPrice(p) : undefined,
});

// Total for a quantity in units: full boxes at box price, the rest at unit price
export const lineTotal = (p: any, qty: number): number => {
  if (!hasBoxPricing(p)) return unitPriceOf(p) * qty;
  const upb = unitsPerBoxOf(p);
  return Math.floor(qty / upb) * boxPriceOf(p) + (qty % upb) * unitPriceOf(p);
};

// True once the quantity includes at least one full box charged at box price
export const boxPriceApplies = (p: any, qty: number): boolean =>
  hasBoxPricing(p) && qty >= unitsPerBoxOf(p);

export const isInStock = (p: any): boolean => Number(p?.currentStock) > 0;
