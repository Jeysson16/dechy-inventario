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

test("decorates Inventory products without turning them into Dechy stock", () => {
  const product = decorateCatalogProduct({ id: "inventory-1", name: "Producto" });

  assert.equal(product.catalogProductId, "inventory-1");
  assert.equal(product.productSource, "inventory");
  assert.equal(product.catalogOnly, true);
  assert.equal(product.stockManagedByDechy, false);
});

test("applies only Dechy commercial fields over the Inventory master product", () => {
  const product = decorateCatalogProduct(
    { id: "inventory-1", name: "Nombre Inventory", unitPrice: 10 },
    {
      id: "branch-link",
      commercial: { name: "No debe cambiar", unitPrice: 14.5, isOnSale: true },
    },
  );

  assert.equal(product.name, "Nombre Inventory");
  assert.equal(product.unitPrice, 14.5);
  assert.equal(product.isOnSale, true);
  assert.equal(product.hasBranchCommercialConfig, true);
});

test("uses Dechy local prices without replacing Inventory identity", () => {
  const product = decorateCatalogProduct(
    {
      id: "inventory-1",
      name: "Nombre Inventory",
      imageUrl: "inventory.jpg",
      unitPrice: 10,
    },
    null,
    {
      id: "dechy-1",
      name: "Nombre antiguo",
      imageUrl: "old.jpg",
      unitPrice: 18.5,
      boxPrice: 170,
      visible: true,
    },
  );

  assert.equal(product.name, "Nombre Inventory");
  assert.equal(product.imageUrl, "inventory.jpg");
  assert.equal(product.unitPrice, 18.5);
  assert.equal(product.boxPrice, 170);
  assert.equal(product.dechyProductId, "dechy-1");
});

test("keeps an explicit branch price above a legacy local price", () => {
  const product = decorateCatalogProduct(
    { id: "inventory-1", unitPrice: 10 },
    { commercial: { unitPrice: 21 } },
    { unitPrice: 18 },
  );

  assert.equal(product.unitPrice, 21);
});

test("hides an Inventory product when its Dechy branch record is hidden", () => {
  const product = decorateCatalogProduct(
    { id: "inventory-1", category: "TECHOS", visible: true },
    null,
    { id: "dechy-1", visible: false },
  );

  assert.equal(product.visible, false);
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
    product: { id: "external-1", branchCatalogLinkId: "existing-link" },
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

test("sale snapshot keeps the external reference and minimum history", () => {
  const snapshot = buildSaleProductSnapshot({
    id: "external-7",
    name: "Taladro",
    sku: "T-7",
    imageUrls: [{ url: "https://example.test/taladro.jpg" }],
  });

  assert.equal(snapshot.productId, "external-7");
  assert.equal(snapshot.catalogProductId, "external-7");
  assert.equal(snapshot.productSource, "inventory");
  assert.equal(snapshot.imageUrl, "https://example.test/taladro.jpg");
});
