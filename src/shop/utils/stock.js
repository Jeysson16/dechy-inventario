export const calculateAvailableUnits = (product) => {
  const unitsPerBox = Number(product?.unitsPerBox) || 1;
  const boxStock = Number(product?.currentStock ?? product?.stock ?? 0) || 0;
  const remainderUnits = Number(product?.remainderUnits || 0) || 0;
  return Math.max(boxStock * unitsPerBox + remainderUnits, 0);
};

export const toProductImage = (product) => {
  if (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0) {
    const first = product.imageUrls[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return first.url || "";
  }
  return product?.mainImageUrl || product?.imageUrl || "";
};

export const computeStockFromUnits = (totalUnits, unitsPerBox) => {
  const safeUnitsPerBox = Math.max(Number(unitsPerBox) || 1, 1);
  const safeTotal = Math.max(Number(totalUnits) || 0, 0);

  return {
    currentStock: Math.floor(safeTotal / safeUnitsPerBox),
    remainderUnits: safeTotal % safeUnitsPerBox,
  };
};
