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
 * Public product URL.
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
 * Generates a QR code data-URL (PNG) for the given product.
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
 * Generates a QR code SVG string.
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
