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
