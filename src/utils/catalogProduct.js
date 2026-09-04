export const CATALOG_PRODUCT_SOURCE = "dechy";

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

const HIDDEN_VISIBILITY_VALUES = new Set([
  "false",
  "0",
  "hidden",
  "oculto",
  "oculta",
  "inactivo",
  "inactive",
]);

export const isCatalogProductVisible = (product) => {
  const value = product?.visible;
  if (value === false || value === 0) return false;
  if (
    typeof value === "string" &&
    HIDDEN_VISIBILITY_VALUES.has(value.trim().toLowerCase())
  ) {
    return false;
  }
  return product?.branchCatalogEnabled !== false;
};

const safeIdPart = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_");

export const buildBranchCatalogLinkId = (branchId, catalogProductId) =>
  `${safeIdPart(branchId)}__${safeIdPart(catalogProductId)}`;

export const normalizeCommercialConfig = (input = {}) => {
  const result = {};
  COMMERCIAL_FIELDS.forEach((field) => {
    if (!Object.hasOwn(input, field)) return;
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
// description, images). A branchCatalogProducts link only ever overrides
// commercial fields (e.g. a different catalog price) for a given branch.
export const decorateCatalogProduct = (product, branchLink = null) => {
  const branchCommercial = normalizeCommercialConfig(branchLink?.commercial || {});
  const commercial = { ...branchCommercial };

  return {
    ...product,
    ...commercial,
    id: product.id,
    catalogProductId: product.id,
    productSource: CATALOG_PRODUCT_SOURCE,
    branchCatalogLinkId: branchLink?.id || null,
    // Keeps Sales.jsx's warehouse-location gate bypassed, as it always was for
    // catalog-sourced items — most products don't have a location assigned yet,
    // and enforcing it now would block checkout at the register.
    catalogOnly: true,
    stockManagedByDechy: true,
    branchCatalogEnabled: branchLink?.enabled !== false && isCatalogProductVisible(product),
    branchCommercialConfig: commercial,
    hasBranchCommercialConfig: Object.keys(commercial).length > 0,
  };
};

export const buildBranchCatalogLink = ({ branchId, product, saleDate }) => ({
  branchId,
  catalogProductId: product.catalogProductId || product.id,
  productSource: CATALOG_PRODUCT_SOURCE,
  enabled: true,
  ...(!product.branchCatalogLinkId ? { firstUsedAt: saleDate } : {}),
  lastUsedAt: saleDate,
});

export const buildSaleProductSnapshot = (item) => ({
  productId: item.catalogProductId || item.id || "",
  catalogProductId: item.catalogProductId || item.id || "",
  productSource: item.productSource || CATALOG_PRODUCT_SOURCE,
  productName: item.name || "Sin nombre",
  sku: item.sku || "S/N",
  category: item.category || "Sin categoria",
  imageUrl:
    item.imageUrl ||
    item.mainImageUrl ||
    (Array.isArray(item.imageUrls)
      ? typeof item.imageUrls[0] === "string"
        ? item.imageUrls[0]
        : item.imageUrls[0]?.url || ""
      : ""),
});
