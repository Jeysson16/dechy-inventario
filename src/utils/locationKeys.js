/*
 * product.locations keys come in three formats, all still present in the data:
 *   "<layoutId>__<shelf>-<row>-<level>-<side>"  current format
 *   "<shelf>-<row>-<level>-<side>"              first layout, without prefix
 *   "<shelf>-<row>-<side>"                      first layout, level 1, oldest format
 * The map, the level drawer and the cleanup must all read the same keys.
 */

export const firstLayoutId = (layouts) => layouts[0]?.id || "main";

export const levelCountAt = (layout, shelfIdx, rowIdx, side) =>
  (layout.customAreaLevels || {})[`${shelfIdx}-${rowIdx}-${side}`] ||
  layout.shelves?.[shelfIdx]?.levelsPerFila ||
  1;

/* Every key that stores stock for one level of one slot */
export const levelAliases = (layouts, layout, shelfIdx, rowIdx, levelIdx, side) => {
  const base = `${shelfIdx}-${rowIdx}-${levelIdx}-${side}`;
  const keys = [`${layout.id}__${base}`];
  if (layout.id === firstLayoutId(layouts)) {
    keys.push(base);
    if (levelIdx === 0) keys.push(`${shelfIdx}-${rowIdx}-${side}`);
  }
  return keys;
};

const positiveQty = (value) => {
  const n = Number(value);
  return n > 0 ? n : 0;
};

export const qtyAt = (product, keys) =>
  keys.reduce((sum, k) => sum + positiveQty(product.locations?.[k]), 0);

export const slotTotal = (layouts, layout, products, shelfIdx, rowIdx, side) => {
  let total = 0;
  for (let l = 0; l < levelCountAt(layout, shelfIdx, rowIdx, side); l++) {
    const keys = levelAliases(layouts, layout, shelfIdx, rowIdx, l, side);
    products.forEach((p) => {
      total += qtyAt(p, keys);
    });
  }
  return total;
};

/*
 * Location entries that no slot of any layout shows: a deleted layout, a shelf,
 * row or level removed from the layout, or a quantity of zero or less.
 */
export const findStrayLocations = (layouts, products) => {
  if (!layouts.length) return [];
  const valid = new Set();
  layouts.forEach((layout) => {
    (layout.shelves || []).forEach((shelf, shelfIdx) => {
      const sides = shelf.type === "double" ? ["A", "B"] : ["A"];
      for (let rowIdx = 0; rowIdx < (Number(shelf.rows) || 0); rowIdx++) {
        sides.forEach((side) => {
          for (let l = 0; l < levelCountAt(layout, shelfIdx, rowIdx, side); l++) {
            levelAliases(layouts, layout, shelfIdx, rowIdx, l, side).forEach((k) => valid.add(k));
          }
        });
      }
    });
  });

  const stray = [];
  products.forEach((p) => {
    Object.entries(p.locations || {}).forEach(([key, qty]) => {
      if (!valid.has(key) || positiveQty(qty) === 0) {
        stray.push({ productId: p.id, productName: p.name, key, qty: Number(qty) || 0 });
      }
    });
  });
  return stray;
};
