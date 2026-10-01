import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCreatorBranches,
  mergeProductUpdates,
  planBranchSplit,
} from "../src/utils/branchSplit.js";

const branchIds = ["dechy", "kinacha"];
const categoryFields = ["categoryId", "subcategoryId", "categoryPathIds"];

test("asigna a una sola empresa la categoría que solo ella usa", () => {
  const plan = planBranchSplit({
    items: [{ id: "pisos", name: "PISOS", parentId: null }],
    products: [{ id: "p1", branch: "dechy", categoryId: "pisos" }],
    branchIds,
    refFields: categoryFields,
  });
  assert.deepEqual(plan.updates, [{ id: "pisos", data: { branchId: "dechy", parentId: null } }]);
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.productUpdates.length, 0);
});

test("duplica una categoría compartida y re-apunta los productos de la otra empresa", () => {
  const plan = planBranchSplit({
    items: [
      { id: "lum", name: "LUMINARIAS", parentId: null },
      { id: "esp", name: "ESPEJO LED", parentId: "lum" },
      { id: "foc", name: "FOCOS", parentId: "lum" },
    ],
    products: [
      { id: "p1", branch: "dechy", categoryId: "lum", subcategoryId: "foc", categoryPathIds: ["lum", "foc"] },
      { id: "p2", branch: "dechy", categoryId: "lum", subcategoryId: "foc", categoryPathIds: ["lum", "foc"] },
      { id: "p3", branch: "kinacha", categoryId: "lum", subcategoryId: "esp", categoryPathIds: ["lum", "esp"] },
    ],
    branchIds,
    refFields: categoryFields,
  });

  // DECHY has more products under LUMINARIAS, so it keeps the original id
  assert.deepEqual(plan.updates.find((u) => u.id === "lum").data, { branchId: "dechy", parentId: null });
  const lumCopy = plan.creates.find((c) => c.data.splitFrom === "lum");
  assert.equal(lumCopy.id, "lum__kinacha");
  assert.equal(lumCopy.data.branchId, "kinacha");
  assert.equal(lumCopy.data.name, "LUMINARIAS");

  // ESPEJO LED only belongs to KINACHA and keeps its id, re-parented to KINACHA's copy
  assert.deepEqual(plan.updates.find((u) => u.id === "esp").data, { branchId: "kinacha", parentId: "lum__kinacha" });

  assert.deepEqual(plan.productUpdates, [
    { id: "p3", data: { categoryId: "lum__kinacha", categoryPathIds: ["lum__kinacha", "esp"] } },
  ]);
});

test("una categoría sin uso va a la empresa de quien la creó", () => {
  const plan = planBranchSplit({
    items: [
      { id: "bano", name: "BAÑO", parentId: null },
      { id: "duchas", name: "DUCHAS", parentId: "bano" },
    ],
    products: [],
    branchIds,
    refFields: categoryFields,
    creatorBranch: { duchas: "kinacha" },
  });
  assert.equal(plan.creates.length, 0);
  assert.deepEqual(plan.updates.map((u) => [u.id, u.data.branchId]), [
    ["bano", "kinacha"],
    ["duchas", "kinacha"],
  ]);
});

test("sin uso ni creador conocido se copia a todas las empresas, con sus padres", () => {
  const plan = planBranchSplit({
    items: [
      { id: "bano", name: "BAÑO", parentId: null },
      { id: "duchas", name: "DUCHAS", parentId: "bano" },
    ],
    products: [],
    branchIds,
    refFields: categoryFields,
  });
  assert.equal(plan.updates.length, 2);
  assert.equal(plan.creates.length, 2);
  const duchasCopy = plan.creates.find((c) => c.data.splitFrom === "duchas");
  assert.equal(duchasCopy.data.parentId, "bano__kinacha");
});

test("separa marcas planas sin agregarles parentId", () => {
  const plan = planBranchSplit({
    items: [{ id: "b1", name: "PHILIPS" }],
    products: [
      { id: "p1", branch: "dechy", brandId: "b1" },
      { id: "p2", branch: "kinacha", brandId: "b1" },
      { id: "p3", branch: "kinacha", brandId: "b1" },
    ],
    branchIds,
    refFields: ["brandId"],
  });
  assert.deepEqual(plan.updates, [{ id: "b1", data: { branchId: "kinacha" } }]);
  assert.deepEqual(plan.creates, [{ id: "b1__dechy", data: { name: "PHILIPS", branchId: "dechy", splitFrom: "b1" } }]);
  assert.deepEqual(plan.productUpdates, [{ id: "p1", data: { brandId: "b1__dechy" } }]);
});

test("ignora lo que ya tiene empresa", () => {
  const plan = planBranchSplit({
    items: [{ id: "a", name: "A", branchId: "dechy" }],
    branchIds,
    refFields: categoryFields,
  });
  assert.equal(plan.legacyCount, 0);
  assert.equal(plan.updates.length + plan.creates.length, 0);
});

test("atribuye al movimiento más cercano dentro de la ventana", () => {
  const minute = 60 * 1000;
  const result = inferCreatorBranches({
    items: [
      { id: "a", createdAt: new Date(100 * minute) },
      { id: "b", createdAt: { seconds: 500 * 60 } },
    ],
    activity: [
      { branchId: "dechy", at: new Date(80 * minute) },
      { branchId: "kinacha", at: new Date(103 * minute) },
    ],
  });
  assert.deepEqual(result, { a: "kinacha" });
});

test("combina en una sola escritura los cambios de categoría y marca del mismo producto", () => {
  assert.deepEqual(
    mergeProductUpdates(
      [{ id: "p1", data: { categoryId: "c" } }],
      [{ id: "p1", data: { brandId: "b" } }, { id: "p2", data: { brandId: "b" } }],
    ),
    [
      { id: "p1", data: { categoryId: "c", brandId: "b" } },
      { id: "p2", data: { brandId: "b" } },
    ],
  );
});
