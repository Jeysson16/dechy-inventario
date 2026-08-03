export const CATALOG_PRODUCT_SOURCE = "inventory";

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

export const normalizeProductMatchKey = (value: any): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

export const decorateCatalogProduct = (
  product: any,
  branchLink: any = null,
  localProduct: any = null,
): any => {
  const localCommercial = normalizeCommercialConfig(localProduct || {});
  const branchCommercial = normalizeCommercialConfig(branchLink?.commercial || {});
  const commercial = { ...localCommercial, ...branchCommercial };
  const price = Number(commercial.unitPrice ?? commercial.price ?? product.unitPrice ?? product.price ?? 0);
  const currentStock = product.currentStock !== undefined && product.currentStock !== null
    ? Number(product.currentStock)
    : 100;
  const minStock = Number(product.minStock || 0);

  return {
    ...product,
    ...commercial,
    id: product.id,
    catalogProductId: product.id,
    productSource: CATALOG_PRODUCT_SOURCE,
    branchCatalogLinkId: branchLink?.id || null,
    dechyProductId: localProduct?.id || null,
    catalogOnly: true,
    stockManagedByDechy: false,
    branchCatalogEnabled:
      branchLink?.enabled !== false && isCatalogProductVisible(localProduct),
    branchCommercialConfig: commercial,
    hasBranchCommercialConfig: Object.keys(commercial).length > 0,
    price,
    currentStock,
    minStock
  };
};
