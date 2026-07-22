import test from "node:test";
import assert from "node:assert/strict";
import { calculatePurchaseTotals, purchaseTaxEffect, validatePurchase } from "../src/utils/purchases.js";

test("calcula base, IGV y total de una compra", () => {
  assert.deepEqual(calculatePurchaseTotals({ taxableBase: 100, igv: 18, nonTaxableAmount: 20, otherTaxes: 1.5 }), {
    taxableBase: 100,
    igv: 18,
    nonTaxableAmount: 20,
    otherTaxes: 1.5,
    total: 139.5,
  });
});

test("valida los campos mínimos del Registro de Compras", () => {
  const errors = validatePurchase({
    supplierRuc: "20100070970", supplierName: "PROVEEDOR SAC", documentType: "01",
    series: "F001", number: "25", issueDate: "2026-07-17", taxableBase: 100, igv: 18,
  });
  assert.deepEqual(errors, []);
  assert.ok(validatePurchase({}).length > 0);
});

test("la nota de crédito recibida reduce el efecto tributario", () => {
  assert.equal(purchaseTaxEffect("07"), -1);
  assert.equal(purchaseTaxEffect("01"), 1);
  assert.equal(purchaseTaxEffect("08"), 1);
});
