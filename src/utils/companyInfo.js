import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// Shared company/branch fiscal info used by both the sale receipt and the
// quote (cotización) documents, so logo loading and field fallbacks stay
// consistent across every printed/exported document.

export const DEFAULT_COMPANY = {
  name: "DECHY",
  razonSocial: "DECHY",
  ruc: "",
  address: "",
  direccion: "",
  ubigeo: "",
  establishmentCode: "0000",
  facturaSeries: "F001",
  boletaSeries: "B001",
  phone: "+51 946 303 481",
  email: "",
  web: "",
  logoPath: "/img/brand/logo-sistema.png",
};

export const pickFirst = (...values) =>
  values.find((value) => String(value || "").trim()) || "";

export function resolveAssetUrl(src) {
  if (!src) return "";
  if (/^data:|^https?:\/\//i.test(src)) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${window.location.origin}${path}`;
}

export function normalizeCompanyData(source = {}) {
  const publicConfig = source.publicConfig || {};
  const config = source.configuracion || {};
  const contact = config.contacto || {};
  return {
    name: pickFirst(source.name, publicConfig.name),
    razonSocial: pickFirst(
      source.razonSocial,
      source.razon_social,
      publicConfig.razonSocial,
      publicConfig.razon_social,
      source.name,
    ),
    ruc: pickFirst(source.ruc, publicConfig.ruc),
    address: pickFirst(
      source.address,
      source.direccion,
      publicConfig.direccion,
      contact.direccion,
      source.location,
    ),
    direccion: pickFirst(
      source.direccion,
      publicConfig.direccion,
      contact.direccion,
      source.location,
    ),
    ubigeo: pickFirst(source.ubigeo, publicConfig.ubigeo),
    establishmentCode: pickFirst(
      source.establishmentCode,
      publicConfig.establishmentCode,
    ),
    facturaSeries: pickFirst(source.facturaSeries, publicConfig.facturaSeries),
    boletaSeries: pickFirst(source.boletaSeries, publicConfig.boletaSeries),
    phone: pickFirst(source.phone, source.telefono, contact.telefono),
    email: pickFirst(source.email, source.correo, contact.correo),
    web: pickFirst(source.web, source.website, publicConfig.web),
    // `image` is the canonical logo of a branch and is also used by the
    // browser tab/favicon. Prefer it so every printed document identifies
    // the currently selected branch consistently.
    logoPath: pickFirst(source.image, config.logo, source.logo, source.logoPath),
  };
}

export function mergeCompanyData(...sources) {
  return sources.reduce(
    (acc, source) => ({
      ...acc,
      ...Object.fromEntries(
        Object.entries(normalizeCompanyData(source)).filter(([, value]) =>
          String(value || "").trim(),
        ),
      ),
    }),
    { ...DEFAULT_COMPANY },
  );
}

async function fetchAsDataUrl(url) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Resolves a company logo (possibly a Firebase Storage URL uploaded per
// branch) to a data URL for embedding in a PDF. If the custom logo can't be
// fetched (missing CORS config on the storage bucket, deleted file, etc.)
// it silently falls back to the bundled PNG so a logo is always printed.
export async function companyLogoToDataUrl(logoPath) {
  const candidates = [logoPath, DEFAULT_COMPANY.logoPath].filter(
    (value, index, arr) => value && arr.indexOf(value) === index,
  );
  for (const candidate of candidates) {
    const url = resolveAssetUrl(candidate);
    if (!url) continue;
    try {
      return await fetchAsDataUrl(url);
    } catch (error) {
      console.warn(`No se pudo cargar el logo (${url}):`, error);
    }
  }
  return null;
}

// Loads the public fiscal/company settings plus the current branch's own
// overrides (logo, address, contact) and merges them, so any page needing
// to print a company header (receipts, quotes, labels) gets one source.
export function useCompanyInfo(branchId) {
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [settingsSnapshot, branchSnapshot] = await Promise.all([
          getDoc(doc(db, "settings", "sunat")),
          branchId ? getDoc(doc(db, "branches", branchId)) : Promise.resolve(null),
        ]);
        const settingsData = settingsSnapshot.exists() ? settingsSnapshot.data() : {};
        const branchData = branchSnapshot?.exists()
          ? { id: branchSnapshot.id, ...branchSnapshot.data() }
          : {};
        if (!cancelled) setCompany(mergeCompanyData(settingsData, branchData));
      } catch (error) {
        console.error("Error loading company info:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { company, loading };
}
