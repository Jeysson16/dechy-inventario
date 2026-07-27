import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBranchCatalogLink,
  buildBranchCatalogLinkId,
  buildSaleProductSnapshot,
  decorateCatalogProduct,
} from "../src/utils/catalogProduct.js";

test("decorates Inventory products without turning them into Dechy stock", () => {
  const product = decorateCatalogProduct({ id: "inventory-1", name: "Producto" });

  assert.equal(product.catalogProductId, "inventory-1");
  assert.equal(product.productSource, "inventory");
  assert.equal(product.catalogOnly, true);
  assert.equal(product.stockManagedByDechy, false);
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
