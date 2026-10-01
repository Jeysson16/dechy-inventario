// Splits legacy shared catalog data (categories, brands) that has no branchId
// into one independent set per company.

const asText = (value) => (typeof value === "string" ? value.trim() : "");

export const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const millis = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
};

// Nobody recorded who created each legacy item, so attribute it to the company
// where someone was working when it was created: the closest activity
// (inventory movement) within the window.
export const inferCreatorBranches = ({ items = [], activity = [], windowMs = 30 * 60 * 1000 }) => {
  const events = activity
    .map((event) => ({ branchId: asText(event.branchId), at: toMillis(event.at) }))
    .filter((event) => event.branchId && event.at !== null);

  const result = {};
  items.forEach((item) => {
    const createdAt = toMillis(item.createdAt);
    if (createdAt === null) return;
    let best = null;
    events.forEach((event) => {
      const distance = Math.abs(event.at - createdAt);
      if (distance <= windowMs && (!best || distance < best.distance)) {
        best = { branchId: event.branchId, distance };
      }
    });
    if (best) result[item.id] = best.branchId;
  });
  return result;
};

// An item goes to every company whose products use it (directly or through a
// descendant) plus the company that created it; an unused subtree with no known
// creator is copied to every company. One company keeps the original doc id, the
// rest get copies with deterministic ids (so re-running is idempotent) and their
// products are re-pointed to the copy.
export const planBranchSplit = ({
  items = [],
  products = [],
  branchIds = [],
  refFields = [],
  creatorBranch = {},
}) => {
  const legacy = items.filter((item) => asText(item.id) && !asText(item.branchId));
  const legacyById = Object.fromEntries(legacy.map((item) => [item.id, item]));
  const copyId = (id, branchId) => `${id}__${branchId}`;
  const parentOf = (item) => {
    const parentId = asText(item.parentId);
    return parentId && legacyById[parentId] ? parentId : null;
  };

  const productRefs = (product) =>
    refFields
      .flatMap((field) => (Array.isArray(product[field]) ? product[field] : [product[field]]))
      .map(asText)
      .filter((id) => legacyById[id]);

  // Direct usage: itemId -> Map(branchId -> product count)
  const usage = new Map(legacy.map((item) => [item.id, new Map()]));
  products.forEach((product) => {
    if (!branchIds.includes(product.branch)) return;
    new Set(productRefs(product)).forEach((id) => {
      const counts = usage.get(id);
      counts.set(product.branch, (counts.get(product.branch) || 0) + 1);
    });
  });

  const directOwners = (id) => {
    const owners = new Set(usage.get(id).keys());
    if (branchIds.includes(creatorBranch[id])) owners.add(creatorBranch[id]);
    return owners;
  };

  const childrenOf = new Map();
  legacy.forEach((item) => {
    const parentId = parentOf(item);
    if (!parentId) return;
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId).push(item.id);
  });

  const subtreeOwned = new Map();
  const isSubtreeOwned = (id, chain = new Set()) => {
    if (subtreeOwned.has(id)) return subtreeOwned.get(id);
    if (chain.has(id)) return false;
    chain.add(id);
    const owned =
      directOwners(id).size > 0 ||
      (childrenOf.get(id) || []).some((childId) => isSubtreeOwned(childId, chain));
    subtreeOwned.set(id, owned);
    return owned;
  };

  // Every company that owns an item must also own all of its ancestors
  const owners = new Map(legacy.map((item) => [item.id, new Set()]));
  legacy.forEach((item) => {
    const base = isSubtreeOwned(item.id) ? [...directOwners(item.id)] : branchIds;
    let currentId = item.id;
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      base.forEach((branchId) => owners.get(currentId).add(branchId));
      currentId = parentOf(legacyById[currentId]);
    }
  });

  const depthOf = (item) => {
    let depth = 0;
    let currentId = parentOf(item);
    const seen = new Set([item.id]);
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      depth += 1;
      currentId = parentOf(legacyById[currentId]);
    }
    return depth;
  };

  const ordered = [...legacy].sort((a, b) => depthOf(a) - depthOf(b));
  const idFor = new Map(); // `${oldId}|${branchId}` -> id in that company
  const updates = [];
  const creates = [];

  ordered.forEach((item) => {
    const counts = usage.get(item.id);
    const companyIds = branchIds.filter((branchId) => owners.get(item.id).has(branchId));
    // Most products keeps the id (fewer re-points); ties go to the creator
    const keeper = [...companyIds].sort(
      (a, b) =>
        (counts.get(b) || 0) - (counts.get(a) || 0) ||
        Number(b === creatorBranch[item.id]) - Number(a === creatorBranch[item.id]),
    )[0];
    const oldParentId = parentOf(item);

    companyIds.forEach((branchId) => {
      const id = branchId === keeper ? item.id : copyId(item.id, branchId);
      idFor.set(`${item.id}|${branchId}`, id);
      const data = { branchId };
      if ("parentId" in item) {
        data.parentId = oldParentId ? idFor.get(`${oldParentId}|${branchId}`) || null : null;
      }
      if (id === item.id) {
        updates.push({ id, data });
      } else {
        const { id: _omit, ...rest } = item;
        creates.push({ id, data: { ...rest, ...data, splitFrom: item.id } });
      }
    });
  });

  const productUpdates = [];
  products.forEach((product) => {
    if (!branchIds.includes(product.branch) || productRefs(product).length === 0) return;
    const remap = (id) => {
      const text = asText(id);
      return legacyById[text] ? idFor.get(`${text}|${product.branch}`) || text : id;
    };
    const data = {};
    refFields.forEach((field) => {
      const value = product[field];
      if (Array.isArray(value)) {
        const next = value.map(remap);
        if (next.some((id, index) => id !== value[index])) data[field] = next;
      } else if (asText(value) && remap(value) !== value) {
        data[field] = remap(value);
      }
    });
    if (Object.keys(data).length > 0) productUpdates.push({ id: product.id, data });
  });

  return { legacyCount: legacy.length, updates, creates, productUpdates };
};

// Several splits can touch the same product: merge into one write per product
export const mergeProductUpdates = (...lists) => {
  const merged = new Map();
  lists.flat().forEach(({ id, data }) => {
    merged.set(id, { ...(merged.get(id) || {}), ...data });
  });
  return [...merged].map(([id, data]) => ({ id, data }));
};
