export const DEFAULT_MIN_MARGIN_PERCENT = 15;
export const HIGH_MARKUP_PERCENT = 80;

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getUnitCost(product = {}) {
  return Number(product.costPrice || product.costo || product.cost || 0) || 0;
}

export function getModeUnits(product = {}, saleMode = "unidades") {
  if (saleMode === "cajas") return Number(product.unitsPerBox) || 1;
  if (saleMode === "docenas") return 12;
  return 1;
}

export function getPricingSnapshot(product = {}, {
  subtotal = 0,
  totalUnits = 0,
  activePrice = 0,
  saleMode = "unidades",
  minMarginPercent = DEFAULT_MIN_MARGIN_PERCENT,
} = {}) {
  const unitCost = getUnitCost(product);
  const quantityUnits = Number(totalUnits) || 0;
  const grossSubtotal = Number(subtotal) || 0;
  const costTotal = roundMoney(unitCost * quantityUnits);
  const grossProfit = roundMoney(grossSubtotal - costTotal);
  const marginPercent = grossSubtotal > 0
    ? roundMoney((grossProfit / grossSubtotal) * 100)
    : null;
  const unitFinalPrice = quantityUnits > 0
    ? grossSubtotal / quantityUnits
    : Number(activePrice) / getModeUnits(product, saleMode) || 0;
  const markupPercent = unitCost > 0
    ? roundMoney(((unitFinalPrice - unitCost) / unitCost) * 100)
    : null;
  const recommendedUnitPrice = unitCost > 0 && minMarginPercent < 100
    ? roundMoney(unitCost / (1 - minMarginPercent / 100))
    : 0;
  const recommendedModePrice = roundMoney(recommendedUnitPrice * getModeUnits(product, saleMode));

  let pricingStatus = "unknown_cost";
  if (unitCost > 0 && grossSubtotal > 0) {
    if (grossProfit < 0) pricingStatus = "below_cost";
    else if (marginPercent < minMarginPercent) pricingStatus = "low_margin";
    else if (markupPercent > HIGH_MARKUP_PERCENT) pricingStatus = "high_markup";
    else pricingStatus = "normal";
  }

  return {
    costPrice: roundMoney(unitCost),
    costTotal,
    grossProfit,
    marginPercent,
    markupPercent,
    recommendedUnitPrice,
    recommendedModePrice,
    pricingStatus,
    minMarginPercent,
  };
}

export function getPricingLabel(status) {
  if (status === "below_cost") return "Bajo costo";
  if (status === "low_margin") return "Margen bajo";
  if (status === "high_markup") return "Margen alto";
  if (status === "normal") return "Normal";
  return "Sin costo";
}
