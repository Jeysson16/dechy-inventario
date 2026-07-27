export const CATALOG_PRODUCT_SOURCE = "inventory";

const safeIdPart = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_");

export const buildBranchCatalogLinkId = (branchId, catalogProductId) =>
  `${safeIdPart(branchId)}__${safeIdPart(catalogProductId)}`;

export const decorateCatalogProduct = (product, branchLink = null) => ({
  ...product,
  id: product.id,
  catalogProductId: product.id,
  productSource: CATALOG_PRODUCT_SOURCE,
  branchCatalogLinkId: branchLink?.id || null,
  catalogOnly: true,
  stockManagedByDechy: false,
  branchCatalogEnabled: branchLink?.enabled !== false,
});

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
