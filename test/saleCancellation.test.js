import test from "node:test";
import assert from "node:assert/strict";
import { buildSaleCancellationUpdate, getSaleCancellationBlock } from "../src/utils/sunat.js";

const user = { uid: "u1", name: "Ana", email: "ana@dechy.pe" };

test("anula una nota de venta solo internamente", () => {
  const update = buildSaleCancellationUpdate(
    { status: "pending_delivery", documentType: "note" },
    { user, reason: "Producto equivocado" },
  );
  assert.equal(update.status, "cancelled");
  assert.equal(update.cancellationScope, "internal_only");
  assert.equal(update["sunat.voidStatus"], undefined);
});

test("una boleta con correlativo reservado queda con baja pendiente", () => {
  const update = buildSaleCancellationUpdate(
    { status: "pending_delivery", documentType: "boleta", sunat: { status: "validated", documentId: "B001-15" } },
    { user, reason: "Cliente desistió", kind: "rejected" },
  );
  assert.equal(update.cancellationScope, "fiscal_void_pending");
  assert.equal(update.cancellationKind, "rejected");
  assert.equal(update["sunat.voidStatus"], "pending");
});

test("no anula ventas despachadas ni comprobantes aceptados", () => {
  assert.match(getSaleCancellationBlock({ status: "completed", documentType: "note" }), /despachada/);
  assert.match(
    getSaleCancellationBlock({ status: "pending_delivery", documentType: "factura", sunat: { status: "accepted", documentId: "F001-9" } }),
    /Nota de Crédito/,
  );
  assert.throws(() => buildSaleCancellationUpdate({ status: "cancelled" }, { user, reason: "Duplicada" }), /ya está anulada/);
});

test("exige un motivo", () => {
  assert.throws(
    () => buildSaleCancellationUpdate({ status: "pending_delivery", documentType: "note" }, { user, reason: "  " }),
    /motivo/,
  );
});
