/**
 * Product utilities — SKU generation, slug generation, QR helpers
 */

/* ── Category → prefix map ── */
const CATEGORY_PREFIXES = {
  "cielo raso": "CR",
  cielorraso: "CR",
  "cielo-raso": "CR",
  wallpanel: "WP",
  panel: "PAN",
  ceramica: "CER",
  ceramico: "CER",
  porcelanato: "POR",
  piso: "PIS",
  pared: "PAR",
  pintura: "PNT",
  adhesivo: "ADH",
  fragua: "FRG",
  perfil: "PRF",
  angulo: "ANG",
  "te ": "TE",
  baldosa: "BAL",
  listelo: "LST",
  zocalo: "ZOC",
  moldura: "MOL",
  accesorio: "ACC",
  herramienta: "HER",
  madera: "MAD",
  yeso: "YES",
  drywall: "DRW",
  tapiz: "TAP",
  muro: "MUR",
  teja: "TEJ",
};

/** Returns a 2–3 letter prefix for the given category name. */
export function getCategoryPrefix(categoryName = "") {
  const lower = (categoryName || "").toLowerCase().trim();
  for (const [key, prefix] of Object.entries(CATEGORY_PREFIXES)) {
    if (lower.includes(key)) return prefix;
  }
  // Fallback: first 3 uppercase letters of category
  const safe = categoryName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return safe.slice(0, 3) || "PRD";
}

/** Generates a unique SKU: e.g. CR-084621 */
export function generateSKU(categoryName = "") {
  const prefix = getCategoryPrefix(categoryName);
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return `${prefix}-${digits}`;
}

/**
 * Normalises text: removes accents + non-alphanumeric, lowercases.
 * Used for slug building.
 */
function normaliseText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Generates an SEO-friendly slug from a product name + SKU.
 * Example: "Wall Panel Poliestireno" + "WP-084621" → "wall-panel-poliestireno-wp084621"
 */
export function generateSlug(name = "", sku = "") {
  const nameSlug = normaliseText(name);
  const skuSuffix = sku.toLowerCase().replace(/[^a-z0-9]/g, "");
  return skuSuffix ? `${nameSlug}-${skuSuffix}` : nameSlug;
}

/**
 * Public product URL for the embedded /tienda shop (same app, same domain).
 * In development it will be localhost.
 * Set the VITE_PUBLIC_DOMAIN env var (or update this constant) for production.
 */
export function getProductPublicUrl(slug = "", productId = "") {
  const base =
    import.meta.env.VITE_PUBLIC_DOMAIN ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const path = slug
    ? `/tienda/producto/${slug}`
    : `/tienda/producto/${productId}`;
  return `${base}${path}`;
}

/**
 * Generates a QR code data-URL (PNG) for the given product's /tienda page.
 * Returns a Promise<string> (data URL).
 */
export async function generateProductQR(
  slug = "",
  productId = "",
  options = {},
) {
  const QRCode = (await import("qrcode")).default;
  const url = getProductPublicUrl(slug, productId);
  return QRCode.toDataURL(url, {
    width: options.width || 300,
    margin: options.margin ?? 1,
    color: {
      dark: options.dark || "#0F172A",
      light: options.light || "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
}

/**
 * Generates a QR code SVG string for the product's /tienda page.
 */
export async function generateProductQRSVG(slug = "", productId = "") {
  const QRCode = (await import("qrcode")).default;
  const url = getProductPublicUrl(slug, productId);
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "H",
  });
}

/**
 * Base URL of the public Dechy catalog/revista (catalogo-astro) — the
 * storefront customers actually browse and that printed labels should
 * point to. Override with VITE_CATALOG_PUBLIC_URL once a custom domain is
 * connected; defaults to the Firebase Hosting "catalogo" target's .web.app.
 */
const CATALOG_BASE_URL =
  import.meta.env.VITE_CATALOG_PUBLIC_URL ||
  "https://dechy-inventario-catalogo.web.app";

/**
 * Public catalog URL for a product: opens catalogo-astro scoped to the
 * product's branch, with a `producto` param that auto-opens its detail
 * modal (see Catalog.tsx's deep-link effect). Used for printed labels.
 */
export function getCatalogProductUrl(slug = "", productId = "", branchId = "") {
  const params = new URLSearchParams();
  if (branchId) params.set("branch", branchId);
  params.set("producto", slug || productId || "");
  return `${CATALOG_BASE_URL}/?${params.toString()}`;
}

/** Generates a QR code data-URL (PNG) pointing to the product's catalog page. */
export async function generateCatalogProductQR(
  slug = "",
  productId = "",
  branchId = "",
  options = {},
) {
  const QRCode = (await import("qrcode")).default;
  const url = getCatalogProductUrl(slug, productId, branchId);
  return QRCode.toDataURL(url, {
    width: options.width || 300,
    margin: options.margin ?? 1,
    color: {
      dark: options.dark || "#0F172A",
      light: options.light || "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
}
