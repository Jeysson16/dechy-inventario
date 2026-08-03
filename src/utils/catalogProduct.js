export const CATALOG_PRODUCT_SOURCE = "inventory";

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

const LOCAL_OPERATIONAL_FIELDS = [
  "currentStock",
  "remainingUnits",
  "minStock",
  "locations",
  "damagedStock",
  "status",
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

export const normalizeProductMatchKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const buildProductMatchIndex = (products = []) => {
  const byId = new Map();
  const bySku = new Map();
  const byName = new Map();

  products.forEach((product) => {
    [product.catalogProductId, product.productId, product.id]
      .map(normalizeProductMatchKey)
      .filter(Boolean)
      .forEach((key) => byId.set(key, product));

    const sku = normalizeProductMatchKey(product.sku);
    const name = normalizeProductMatchKey(product.name);
    if (sku) bySku.set(sku, product);
    if (name) byName.set(name, product);
  });

  return { byId, bySku, byName };
};

export const findMatchingProduct = (product, index) => {
  if (!product || !index) return null;
  const id = normalizeProductMatchKey(
    product.catalogProductId || product.productId || product.id,
  );
  const sku = normalizeProductMatchKey(product.sku);
  const name = normalizeProductMatchKey(product.name);
  return (
    (id && index.byId.get(id)) ||
    (sku && index.bySku.get(sku)) ||
    (name && index.byName.get(name)) ||
    null
  );
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

export const decorateCatalogProduct = (
  product,
  branchLink = null,
  localProduct = null,
) => {
  const localCommercial = normalizeCommercialConfig(localProduct || {});
  const branchCommercial = normalizeCommercialConfig(
    branchLink?.commercial || {},
  );
  const commercial = { ...localCommercial, ...branchCommercial };
  const operational = {};
  LOCAL_OPERATIONAL_FIELDS.forEach((field) => {
    if (localProduct && Object.hasOwn(localProduct, field)) {
      operational[field] = localProduct[field];
    }
  });

  return {
    ...product,
    ...operational,
    ...commercial,
    ...(localProduct ? { visible: isCatalogProductVisible(localProduct) } : {}),
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
