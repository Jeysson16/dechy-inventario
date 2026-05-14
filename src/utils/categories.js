const asText = (value) => (typeof value === "string" ? value.trim() : "");

const getLocaleCompare = (a, b) =>
  a.localeCompare(b, "es", {
    sensitivity: "base",
    numeric: true,
  });

export const buildCategoryHierarchy = (rawCategories = []) => {
  const normalized = rawCategories
    .map((cat) => ({
      ...cat,
      id: asText(cat.id),
      name: asText(cat.name),
      parentId: asText(cat.parentId) || null,
    }))
    .filter((cat) => cat.id && cat.name);

  const byId = Object.fromEntries(normalized.map((cat) => [cat.id, cat]));
  const resolved = new Map();

  const resolveNode = (catId, chain = new Set()) => {
    if (resolved.has(catId)) return resolved.get(catId);
    const cat = byId[catId];
    if (!cat) return null;

    const hasCycle = chain.has(catId);
    const nextChain = new Set(chain);
    nextChain.add(catId);

    const parent =
      !hasCycle && cat.parentId ? resolveNode(cat.parentId, nextChain) : null;

    const pathNames = parent ? [...parent.pathNames, cat.name] : [cat.name];
    const pathIds = parent ? [...parent.pathIds, cat.id] : [cat.id];

    const node = {
      ...cat,
      parentId: parent ? parent.id : null,
      level: Math.max(pathNames.length - 1, 0),
      pathNames,
      pathIds,
      pathLabel: pathNames.join(" / "),
    };

    resolved.set(catId, node);
    return node;
  };

  const nodes = normalized
    .map((cat) => resolveNode(cat.id))
    .filter(Boolean)
    .sort((a, b) => getLocaleCompare(a.pathLabel, b.pathLabel));

  const roots = nodes.filter((node) => !node.parentId);

  return {
    nodes,
    roots,
    byId: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
};

export const getProductCategoryPath = (product) => {
  const category = asText(product?.category);
  const subcategory = asText(product?.subcategory);
  const categoryPath = asText(product?.categoryPath);

  if (categoryPath) return categoryPath;
  if (category && subcategory) return `${category} / ${subcategory}`;
  if (category) return category;
  return "Sin categoria";
};
