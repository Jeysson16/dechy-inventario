export const ICBPER_UNIT_AMOUNT = 0.5;

export function buildRucCheckDigit(prefix) {
  const digits = String(prefix || "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) return "";
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + weight * Number(digits[index]),
    0,
  );
  const difference = 11 - (sum % 11);
  return String(difference >= 10 ? difference - 10 : difference);
}

export function normalizeLegacyRuc(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) {
    return `${digits}${buildRucCheckDigit(digits)}`;
  }
  return digits;
}

export function isValidRuc(value) {
  const ruc = normalizeLegacyRuc(value);
  if (!/^\d{11}$/.test(ruc)) return false;
  return buildRucCheckDigit(ruc.slice(0, 10)) === ruc[10];
}

export function validateSaleDocument({
  documentType,
  documentRUC,
  customerDNI,
  customerName,
  total,
}) {
  const errors = [];
  if (documentType === "factura") {
    if (!isValidRuc(documentRUC)) {
      errors.push("Ingrese un RUC válido para emitir la factura.");
    }
    if (!String(customerName || "").trim()) {
      errors.push("Ingrese o consulte la razón social del cliente.");
    }
  }
  if (documentType === "boleta") {
    const dni = String(customerDNI || "").trim();
    if (dni && !/^\d{8}$/.test(dni)) {
      errors.push("El DNI debe tener 8 dígitos.");
    }
    if (Number(total) > 700 && !/^\d{8}$/.test(dni)) {
      errors.push("Las boletas mayores a S/ 700 requieren DNI del cliente.");
    }
  }
  return errors;
}

export function fiscalDocumentCode(documentType) {
  return documentType === "factura" ? "01" : documentType === "boleta" ? "03" : null;
}

export function getFiscalCancellationRequirement(sale = {}) {
  const documentCode = fiscalDocumentCode(sale.documentType);
  if (!documentCode) return { kind: "internal", documentCode: null };

  const rawStatus = sale.sunat?.status || sale.sunatStatus ||
    (sale.sentToSunat === true ? "pending_cdr" : "not_sent");
  const status = String(rawStatus).toLowerCase();
  const referenceId = sale.sunat?.documentId || sale.fiscalDocumentId || null;

  if (["voided", "credited", "cancelled_by_credit_note"].includes(status)) {
    return { kind: "internal", documentCode, status, referenceId, fiscalAlreadyCancelled: true };
  }
  if (["sent", "submitted", "processing", "pending", "pending_cdr"].includes(status)) {
    return { kind: "wait_cdr", documentCode, status, referenceId };
  }
  if (["accepted", "accepted_with_observations", "aceptado"].includes(status)) {
    if (sale.sunat?.grantedToCustomer === false) {
      return { kind: "communication_of_baja", documentCode, status, referenceId };
    }
    return {
      kind: "credit_note",
      documentCode,
      status,
      referenceId,
      noteDocumentCode: "07",
      reasonCode: "01",
    };
  }
  return { kind: "internal", documentCode, status, referenceId };
}

export function fiscalCancellationBlockMessage(sale) {
  const requirement = getFiscalCancellationRequirement(sale);
  const reference = requirement.referenceId ? ` ${requirement.referenceId}` : "";
  if (requirement.kind === "wait_cdr") {
    return `El comprobante${reference} fue enviado y todavía no tiene CDR definitivo. Espere la respuesta de SUNAT antes de anular.`;
  }
  if (requirement.kind === "credit_note") {
    return `El comprobante${reference} ya fue aceptado por SUNAT. Debe emitirse una Nota de Crédito 07, motivo 01; no se anuló la venta internamente.`;
  }
  if (requirement.kind === "communication_of_baja") {
    return `El comprobante${reference} fue aceptado pero figura como no otorgado. Requiere comunicación de baja a SUNAT; no se anuló la venta internamente.`;
  }
  return null;
}

function saleIssueDate(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("La fecha de emisión no es válida.");
  return date.toISOString().slice(0, 10);
}

export function buildSunatPreviewPayload({ sale, issuer, series, number, bagCount = 0 }) {
  const documentType = fiscalDocumentCode(sale?.documentType);
  if (!documentType) throw new Error("Las notas de venta internas no se envían a SUNAT.");
  if (Number(bagCount) > 0) {
    throw new Error(
      "El XML de prueba aún no admite ICBPER. Quite las bolsas para evitar un total fiscal inconsistente.",
    );
  }
  return {
    documentType,
    series,
    number,
    issueDate: saleIssueDate(sale.paymentDate),
    issuer: {
      ruc: issuer.ruc,
      businessName: issuer.razonSocial,
      address: issuer.direccion,
      ubigeo: issuer.ubigeo,
      establishmentCode: issuer.establishmentCode || "0000",
    },
    sale,
    customer: {
      document: sale.documentRUC || sale.customerDNI || "",
      name: sale.customerName || "CLIENTE GENERAL",
      address: sale.customerAddress || "",
    },
  };
}
