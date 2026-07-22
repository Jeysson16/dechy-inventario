import { isValidRuc } from "./sunat.js";

export const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const purchaseTaxEffect = (documentType) => documentType === "07" ? -1 : 1;

export function calculatePurchaseTotals(values = {}) {
  const taxableBase = roundMoney(values.taxableBase);
  const igv = roundMoney(values.igv);
  const nonTaxableAmount = roundMoney(values.nonTaxableAmount);
  const otherTaxes = roundMoney(values.otherTaxes);
  return {
    taxableBase,
    igv,
    nonTaxableAmount,
    otherTaxes,
    total: roundMoney(taxableBase + igv + nonTaxableAmount + otherTaxes),
  };
}

export function validatePurchase(values = {}) {
  const errors = [];
  if (!isValidRuc(values.supplierRuc)) errors.push("Ingrese un RUC válido del proveedor.");
  if (!String(values.supplierName || "").trim()) errors.push("Ingrese la razón social del proveedor.");
  if (!/^\d{2}$/.test(String(values.documentType || ""))) errors.push("Seleccione el tipo de comprobante.");
  if (!/^[A-Z0-9]{1,4}$/.test(String(values.series || "").toUpperCase())) errors.push("Serie inválida.");
  if (!/^\d{1,8}$/.test(String(values.number || ""))) errors.push("Número de comprobante inválido.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(values.issueDate || ""))) errors.push("Fecha de emisión inválida.");
  if (calculatePurchaseTotals(values).total <= 0) errors.push("El total de compra debe ser mayor que cero.");
  return errors;
}
