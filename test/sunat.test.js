import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSunatPreviewPayload,
  fiscalCancellationBlockMessage,
  getFiscalCancellationRequirement,
  isValidRuc,
  validateSaleDocument,
} from "../src/utils/sunat.js";
import { SunatApiError, previewSunatDocument } from "../src/services/sunatApi.js";

test("valida RUC peruano", () => {
  assert.equal(isValidRuc("20100070970"), true);
  assert.equal(isValidRuc("20555666777"), false);
});

test("factura requiere RUC y razón social", () => {
  const errors = validateSaleDocument({ documentType: "factura", documentRUC: "123", customerName: "", total: 10 });
  assert.equal(errors.length, 2);
});

test("boleta simple mayor de S/ 700 se rechaza", () => {
  const errors = validateSaleDocument({ documentType: "boleta", customerDNI: "", total: 701 });
  assert.equal(errors.length, 1);
});

test("construye el contrato esperado por el backend", () => {
  const payload = buildSunatPreviewPayload({
    sale: {
      documentType: "boleta",
      paymentDate: "2026-07-15T12:00:00-05:00",
      customerDNI: "12345678",
      customerName: "CLIENTE",
      items: [{ productName: "Producto", quantitySoldUnits: 1, subtotal: 118 }],
    },
    issuer: { ruc: "20100070970", razonSocial: "EMPRESA", direccion: "Lima", ubigeo: "150101" },
    series: "B001",
    number: 15,
  });
  assert.equal(payload.documentType, "03");
  assert.equal(payload.issueDate, "2026-07-15");
  assert.equal(payload.customer.document, "12345678");
  assert.equal(payload.issuer.businessName, "EMPRESA");
});

test("impide generar XML si el ICBPER del ticket no está en el contrato", () => {
  assert.throws(
    () => buildSunatPreviewPayload({
      sale: { documentType: "boleta", items: [] },
      issuer: {},
      series: "B001",
      number: 1,
      bagCount: 1,
    }),
    /ICBPER/,
  );
});

test("una factura no enviada solo requiere anulación interna", () => {
  assert.equal(
    getFiscalCancellationRequirement({ documentType: "factura", sunat: { status: "not_sent" } }).kind,
    "internal",
  );
});

test("un comprobante enviado espera CDR antes de anular", () => {
  const sale = { documentType: "factura", sunat: { status: "pending_cdr", documentId: "F001-25" } };
  assert.equal(getFiscalCancellationRequirement(sale).kind, "wait_cdr");
  assert.match(fiscalCancellationBlockMessage(sale), /CDR definitivo/);
});

test("un comprobante aceptado y otorgado requiere nota de crédito 07 motivo 01", () => {
  const requirement = getFiscalCancellationRequirement({
    documentType: "factura",
    sunat: { status: "accepted", documentId: "F001-25", grantedToCustomer: true },
  });
  assert.equal(requirement.kind, "credit_note");
  assert.equal(requirement.noteDocumentCode, "07");
  assert.equal(requirement.reasonCode, "01");
});

test("un comprobante aceptado pero no otorgado requiere comunicación de baja", () => {
  assert.equal(
    getFiscalCancellationRequirement({
      documentType: "boleta",
      sunat: { status: "accepted", documentId: "B001-25", grantedToCustomer: false },
    }).kind,
    "communication_of_baja",
  );
});

test("cliente HTTP usa preview y acepta únicamente borrador no enviado", async () => {
  let requestedUrl;
  const draft = await previewSunatDocument(
    { documentType: "03" },
    {
      baseUrl: "http://localhost:3001/",
      fetchImpl: async (url, options) => {
        requestedUrl = url;
        assert.equal(options.method, "POST");
        return new Response(JSON.stringify({
          success: true,
          data: {
            status: "DRAFT_UNSIGNED_NOT_SENT",
            sentToSunat: false,
            signed: false,
            cdr: null,
            documentId: "B001-15",
            xml: "<?xml version=\"1.0\"?><Invoice />",
          },
        }), { status: 200 });
      },
    },
  );
  assert.equal(requestedUrl, "http://localhost:3001/api/sunat/preview");
  assert.equal(draft.documentId, "B001-15");
});

test("cliente HTTP rechaza una respuesta que afirme envío", async () => {
  await assert.rejects(
    previewSunatDocument({}, {
      baseUrl: "http://localhost:3001",
      fetchImpl: async () => new Response(JSON.stringify({
        success: true,
        data: { status: "ACCEPTED", sentToSunat: true, signed: true, cdr: "mock", documentId: "B001-1", xml: "<?xml />" },
      }), { status: 200 }),
    }),
    (error) => error instanceof SunatApiError && error.code === "UNSAFE_DRAFT_RESPONSE",
  );
});

test("cliente HTTP conserva los errores de validación 422", async () => {
  await assert.rejects(
    previewSunatDocument({}, {
      baseUrl: "http://localhost:3001",
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        code: "SUNAT_VALIDATION_ERROR",
        errors: [{ field: "issuer.ruc", message: "RUC del emisor inválido." }],
      }), { status: 422 }),
    }),
    (error) => error.code === "SUNAT_VALIDATION_ERROR" && error.status === 422 && error.errors.length === 1,
  );
});
