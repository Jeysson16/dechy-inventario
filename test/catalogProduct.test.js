import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBranchCatalogLink,
  buildBranchCatalogLinkId,
  buildSaleProductSnapshot,
  decorateCatalogProduct,
  isCatalogProductVisible,
  normalizeCommercialConfig,
} from "../src/utils/catalogProduct.js";

test("decorates a Dechy product as stock-managed by Dechy", () => {
  const product = decorateCatalogProduct({ id: "dechy-1", name: "Producto" });

  assert.equal(product.catalogProductId, "dechy-1");
  assert.equal(product.productSource, "dechy");
  assert.equal(product.stockManagedByDechy, true);
});

test("applies a branch commercial override over the product's own price", () => {
  const product = decorateCatalogProduct(
    { id: "dechy-1", name: "Nombre Dechy", unitPrice: 10 },
    {
      id: "branch-link",
      commercial: { name: "No debe cambiar", unitPrice: 14.5, isOnSale: true },
    },
  );

  assert.equal(product.name, "Nombre Dechy");
  assert.equal(product.unitPrice, 14.5);
  assert.equal(product.isOnSale, true);
  assert.equal(product.hasBranchCommercialConfig, true);
});

test("keeps the product's own price when there is no branch override", () => {
  const product = decorateCatalogProduct({ id: "dechy-1", unitPrice: 10 });

  assert.equal(product.unitPrice, 10);
  assert.equal(product.hasBranchCommercialConfig, false);
});

test("hides a product when it is marked not visible", () => {
  const product = decorateCatalogProduct({ id: "dechy-1", category: "TECHOS", visible: false });

  assert.equal(isCatalogProductVisible(product), false);
});

test("normalizes invalid commercial values before saving them in Dechy", () => {
  assert.deepEqual(
    normalizeCommercialConfig({
      unitPrice: "12.50",
      boxPrice: -1,
      sellByUnit: 1,
      unrelated: "ignored",
    }),
    { unitPrice: 12.5, sellByUnit: true },
  );
});

test("preserves the first usage date after a branch link already exists", () => {
  const link = buildBranchCatalogLink({
    branchId: "branch-1",
    product: { id: "dechy-1", branchCatalogLinkId: "existing-link" },
    saleDate: new Date("2026-07-26T00:00:00Z"),
  });

  assert.equal(Object.hasOwn(link, "firstUsedAt"), false);
  assert.equal(link.lastUsedAt.toISOString(), "2026-07-26T00:00:00.000Z");
});

test("creates deterministic branch catalog link ids", () => {
  assert.equal(
    buildBranchCatalogLinkId("branch/one", "product one"),
    "branch_one__product_one",
  );
});

test("sale snapshot keeps the product reference and minimum history", () => {
  const snapshot = buildSaleProductSnapshot({
    id: "dechy-7",
    name: "Taladro",
    sku: "T-7",
    imageUrls: [{ url: "https://example.test/taladro.jpg" }],
  });

  assert.equal(snapshot.productId, "dechy-7");
  assert.equal(snapshot.catalogProductId, "dechy-7");
  assert.equal(snapshot.productSource, "dechy");
  assert.equal(snapshot.imageUrl, "https://example.test/taladro.jpg");
});
