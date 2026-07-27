import test from "node:test";
import assert from "node:assert/strict";
import { getPricingSnapshot } from "../src/utils/pricing.js";

test("calcula margen usando precio de compra y precio final", () => {
  const pricing = getPricingSnapshot(
    { costPrice: 70 },
    { subtotal: 100, totalUnits: 1, activePrice: 100, saleMode: "unidades" },
  );

  assert.equal(pricing.costTotal, 70);
  assert.equal(pricing.grossProfit, 30);
  assert.equal(pricing.marginPercent, 30);
  assert.equal(pricing.pricingStatus, "normal");
});

test("marca venta por debajo del costo", () => {
  const pricing = getPricingSnapshot(
    { costPrice: 80 },
    { subtotal: 70, totalUnits: 1, activePrice: 70, saleMode: "unidades" },
  );

  assert.equal(pricing.grossProfit, -10);
  assert.equal(pricing.pricingStatus, "below_cost");
});

test("calcula minimo sugerido por caja segun margen minimo", () => {
  const pricing = getPricingSnapshot(
    { costPrice: 10, unitsPerBox: 12 },
    { subtotal: 130, totalUnits: 12, activePrice: 130, saleMode: "cajas" },
  );

  assert.equal(pricing.recommendedUnitPrice, 11.76);
  assert.equal(pricing.recommendedModePrice, 141.12);
  assert.equal(pricing.pricingStatus, "low_margin");
});
