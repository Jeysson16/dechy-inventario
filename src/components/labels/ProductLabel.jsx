/**
 * ProductLabel — professional printable product label with QR code.
 *
 * Props:
 *   product   {object}  — Firestore product document
 *   format    {string}  — 'small' | 'medium' | 'premium' | 'a4' | 'horizontal'
 *   onClose   {fn}      — called when the modal X is clicked
 *
 * Features:
 *   • Live label preview (React + Tailwind)
 *   • QR code (auto-generated via qrcode package)
 *   • Browser print (window.print) with dedicated CSS
 *   • PDF export (jsPDF drawing primitives — no html2canvas needed)
 *   • PNG download (canvas rendering)
 *   • Multiple label formats
 */
import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  Printer,
  X,
  Check,
  QrCode,
  Tag,
  Layers,
} from "lucide-react";
import {
  generateProductQR,
  getProductPublicUrl,
} from "../../utils/productUtils";

/* ── Format catalogue ── */
const FORMATS = [
  { id: "medium", label: "Mediana", desc: "Exhibición", w: 400, h: 560 },
  { id: "small", label: "Pequeña", desc: "Estantería", w: 300, h: 200 },
  { id: "premium", label: "Premium", desc: "Showroom", w: 400, h: 680 },
  { id: "a4", label: "A4 Vertical", desc: "Impresión", w: 420, h: 594 },
  { id: "horizontal", label: "Horizontal", desc: "Banner", w: 560, h: 360 },
];

/* ── Brand config (update for production) ── */
const BRAND = {
  name: "Dechy",
  tagline: "Acabados & Construcción",
  web: "www.dechy.pe",
  phone: "+51 999 999 999",
  ig: "@dechystore",
  color: "#CFAE70",
  dark: "#0F172A",
};

/* ── Helpers ── */
function getPrice(product) {
  return Number(product?.unitPrice || product?.price || 0);
}
function getSalePrice(product) {
  return product?.isOnSale && product?.salePrice > 0
    ? Number(product.salePrice)
    : null;
}
function getDiscount(product) {
  return product?.discountPercent || 0;
}
function getImage(product) {
  return (
    product?.mainImageUrl ||
    product?.imageUrl ||
    product?.imageUrls?.[0]?.url ||
    null
  );
}

/* ══════════════════════════════════════════
   LABEL PREVIEW COMPONENTS
   ══════════════════════════════════════════ */

/* ── Small label (shelf tag) ── */
const SmallLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  return (
    <div
      id="label-preview-inner"
      className="relative overflow-hidden rounded-xl border-2 border-slate-700"
      style={{
        width: 300,
        height: 200,
        background: BRAND.dark,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Left: product image */}
      <div className="absolute inset-y-0 left-0 w-[110px]">
        {getImage(product) ? (
          <img
            src={getImage(product)}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-slate-800 flex items-center justify-center">
            <Tag size={28} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0F172A]" />
      </div>

      {/* Right: info */}
      <div className="absolute left-[120px] right-0 top-0 bottom-0 flex flex-col justify-between p-3">
        <div>
          <p
            className="text-[8px] font-bold uppercase tracking-widest"
            style={{ color: BRAND.color }}
          >
            {BRAND.name}
          </p>
          <p className="text-white font-black text-[11px] leading-tight mt-0.5 line-clamp-2">
            {product?.name}
          </p>
          <p className="text-slate-400 text-[9px] mt-0.5 font-mono">
            {product?.sku}
          </p>
        </div>
        <div>
          {salePrice ? (
            <>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[9px] line-through">
                  S/ {price.toFixed(2)}
                </span>
                {discount > 0 && (
                  <span
                    className="text-[8px] font-black px-1 rounded-full text-slate-900"
                    style={{ background: BRAND.color }}
                  >
                    -{discount}%
                  </span>
                )}
              </div>
              <p className="font-black text-rose-400 text-lg leading-none">
                S/ {salePrice.toFixed(2)}
              </p>
            </>
          ) : (
            <p
              className="font-black text-lg leading-none"
              style={{ color: BRAND.color }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
          <p className="text-slate-500 text-[8px] mt-1">{product?.category}</p>
        </div>
        {qrUrl && (
          <img
            src={qrUrl}
            alt="QR"
            className="absolute bottom-2 right-2 rounded"
            style={{ width: 40, height: 40, background: "white", padding: 2 }}
          />
        )}
      </div>
    </div>
  );
};

/* ── Medium label (display) ── */
const MediumLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);
  const url = getProductPublicUrl(product?.slug, product?.id);

  return (
    <div
      id="label-preview-inner"
      className="relative overflow-hidden rounded-2xl border border-slate-700 shadow-2xl"
      style={{
        width: 400,
        height: 560,
        background: BRAND.dark,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Image hero */}
      <div className="relative h-[220px] overflow-hidden">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <Tag size={48} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#0F172A]" />
        {/* Brand top */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
          <span className="text-xs font-black tracking-widest text-white/80 uppercase">
            {BRAND.name}
          </span>
          {discount > 0 && (
            <span
              className="text-xs font-black px-3 py-1 rounded-full text-slate-900 shadow"
              style={{ background: BRAND.color }}
            >
              -{discount}% OFF
            </span>
          )}
        </div>
        {/* SKU bottom */}
        <div className="absolute bottom-3 left-4">
          <span className="text-[10px] font-mono text-white/60 bg-black/40 px-2 py-0.5 rounded">
            {product?.sku}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
            {product?.category}
            {product?.subcategory ? ` · ${product.subcategory}` : ""}
          </p>
          <h2 className="text-white font-black text-xl leading-tight mt-0.5">
            {product?.name}
          </h2>
        </div>

        {/* Price */}
        <div className="flex items-end gap-3">
          {salePrice ? (
            <>
              <div>
                <p className="text-slate-500 text-sm line-through">
                  S/ {price.toFixed(2)}
                </p>
                <p className="font-black text-3xl text-rose-400 leading-none">
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
              <span
                className="text-xs font-black px-2 py-1 rounded-lg text-slate-900 mb-1"
                style={{ background: BRAND.color }}
              >
                Oferta
              </span>
            </>
          ) : (
            <p
              className="font-black text-3xl leading-none"
              style={{ color: BRAND.color }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Spec badges */}
        <div className="flex flex-wrap gap-1.5">
          {product?.length && product?.width ? (
            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              {product.length}×{product.width}
              {product.height ? `×${product.height}` : ""} cm
            </span>
          ) : null}
          {product?.unitsPerBox ? (
            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              {product.unitsPerBox} u/caja
            </span>
          ) : null}
          {product?.category && (
            <span
              className="text-[10px] px-2 py-1 rounded-full bg-slate-800 border border-slate-700 font-medium"
              style={{ color: BRAND.color }}
            >
              {product.category}
            </span>
          )}
        </div>

        {/* QR + footer */}
        <div className="flex items-end justify-between mt-auto pt-2 border-t border-slate-800">
          <div>
            <p className="text-[9px] text-slate-500 font-semibold">
              {BRAND.tagline}
            </p>
            <p className="text-[9px] text-slate-500">{BRAND.web}</p>
          </div>
          {qrUrl && (
            <div className="flex flex-col items-center gap-1">
              <img
                src={qrUrl}
                alt="QR"
                style={{
                  width: 64,
                  height: 64,
                  background: "white",
                  padding: 3,
                  borderRadius: 6,
                }}
              />
              <p className="text-[8px] text-slate-500">Escanea y compra</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Premium label (showroom) ── */
const PremiumLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);

  return (
    <div
      id="label-preview-inner"
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{
        width: 400,
        height: 680,
        background: "#0a1020",
        fontFamily: "Inter, sans-serif",
        border: `2px solid ${BRAND.color}33`,
      }}
    >
      {/* Full bleed image */}
      <div className="relative h-[300px] overflow-hidden">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <Tag size={56} className="text-slate-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-[#0a1020]" />
        {/* Brand overlay */}
        <div className="absolute top-4 left-5 right-5 flex justify-between items-center">
          <div>
            <p
              className="font-black text-sm tracking-widest uppercase"
              style={{ color: BRAND.color }}
            >
              {BRAND.name}
            </p>
            <p className="text-[9px] text-white/60">{BRAND.tagline}</p>
          </div>
          {discount > 0 && (
            <div
              className="rounded-xl px-3 py-1.5 text-center"
              style={{ background: BRAND.color }}
            >
              <p className="text-slate-900 font-black text-base leading-none">
                -{discount}%
              </p>
              <p className="text-slate-900 text-[9px] font-bold">OFERTA</p>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
        {/* Category + SKU */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {product?.category}
            {product?.subcategory ? ` / ${product.subcategory}` : ""}
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
            {product?.sku}
          </span>
        </div>

        {/* Name */}
        <h2 className="text-white font-black text-2xl leading-tight">
          {product?.name}
        </h2>

        {/* Description */}
        {product?.description && (
          <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Price block */}
        <div
          className="rounded-xl p-4 border border-slate-800"
          style={{ background: "rgba(207,174,112,0.07)" }}
        >
          {salePrice ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm line-through">
                  S/ {price.toFixed(2)}
                </p>
                <p className="font-black text-4xl text-rose-400 leading-none">
                  S/ {salePrice.toFixed(2)}
                </p>
                <p className="text-rose-400 text-xs mt-1">
                  Precio especial de oferta
                </p>
              </div>
              <div
                className="rounded-full flex items-center justify-center font-black text-xl text-slate-900 size-16"
                style={{ background: BRAND.color }}
              >
                -{discount}%
              </div>
            </div>
          ) : (
            <div>
              <p className="text-slate-400 text-xs">Precio por unidad</p>
              <p
                className="font-black text-4xl leading-none mt-1"
                style={{ color: BRAND.color }}
              >
                S/ {price.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Spec grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            product?.length && product?.width
              ? `${product.length}×${product.width} cm`
              : null,
            product?.unitsPerBox ? `${product.unitsPerBox} u/caja` : null,
            product?.category || null,
          ]
            .filter(Boolean)
            .map((spec, i) => (
              <div
                key={i}
                className="rounded-lg p-2 text-center bg-slate-800/60 border border-slate-700"
              >
                <p className="text-white text-[10px] font-bold leading-tight">
                  {spec}
                </p>
              </div>
            ))}
        </div>

        {/* QR + footer */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-800 mt-auto">
          <div className="space-y-0.5">
            <p className="text-[9px] text-slate-400 font-semibold">
              {BRAND.web}
            </p>
            <p className="text-[9px] text-slate-500">{BRAND.phone}</p>
            <p className="text-[9px] text-slate-500">{BRAND.ig}</p>
          </div>
          {qrUrl && (
            <div className="flex flex-col items-center gap-1">
              <img
                src={qrUrl}
                alt="QR"
                style={{
                  width: 72,
                  height: 72,
                  background: "white",
                  padding: 4,
                  borderRadius: 8,
                }}
              />
              <p className="text-[8px] text-slate-500">Escanea y compra</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── A4 vertical label ── */
const A4Label = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);
  const url = getProductPublicUrl(product?.slug, product?.id);

  return (
    <div
      id="label-preview-inner"
      style={{
        width: 420,
        height: 594,
        background: "white",
        fontFamily: "Inter, sans-serif",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: BRAND.dark,
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <p
            style={{
              color: BRAND.color,
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {BRAND.name}
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 9 }}>
            {BRAND.tagline}
          </p>
        </div>
        <p
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 9,
            fontFamily: "monospace",
          }}
        >
          {product?.sku}
        </p>
      </div>

      {/* Product image */}
      <div style={{ height: 220, position: "relative", overflow: "hidden" }}>
        {img ? (
          <img
            src={img}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tag size={48} color="#94a3b8" />
          </div>
        )}
        {discount > 0 && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "#f43f5e",
              color: "white",
              borderRadius: 99,
              padding: "6px 14px",
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            -{discount}% OFF
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "16px 20px", flex: 1 }}>
        <p
          style={{
            color: "#64748b",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontWeight: 700,
          }}
        >
          {product?.category}
          {product?.subcategory ? ` / ${product.subcategory}` : ""}
        </p>
        <h2
          style={{
            color: "#0f172a",
            fontWeight: 900,
            fontSize: 22,
            lineHeight: 1.2,
            marginTop: 4,
          }}
        >
          {product?.name}
        </h2>

        {/* Price */}
        <div
          style={{
            marginTop: 12,
            padding: "12px 16px",
            background: BRAND.dark,
            borderRadius: 12,
          }}
        >
          {salePrice ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    textDecoration: "line-through",
                  }}
                >
                  S/ {price.toFixed(2)}
                </p>
                <p
                  style={{
                    color: "#fb7185",
                    fontWeight: 900,
                    fontSize: 32,
                    lineHeight: 1,
                  }}
                >
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
              <div
                style={{
                  background: BRAND.color,
                  color: BRAND.dark,
                  borderRadius: "50%",
                  width: 52,
                  height: 52,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                -{discount}%
              </div>
            </div>
          ) : (
            <p
              style={{
                color: BRAND.color,
                fontWeight: 900,
                fontSize: 32,
                lineHeight: 1,
              }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Specs row */}
        <div
          style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
        >
          {[
            product?.dimensions ||
              (product?.length && `${product.length}×${product.width} cm`),
            product?.unitsPerBox && `${product.unitsPerBox} u/caja`,
            product?.category,
          ]
            .filter(Boolean)
            .map((s, i) => (
              <div
                key={i}
                style={{
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                {s}
              </div>
            ))}
        </div>
      </div>

      {/* QR Footer */}
      <div
        style={{
          borderTop: "1px solid #e2e8f0",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc",
        }}
      >
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#475569" }}>
            {BRAND.web}
          </p>
          <p style={{ fontSize: 9, color: "#94a3b8" }}>{url}</p>
        </div>
        {qrUrl && (
          <div style={{ textAlign: "center" }}>
            <img src={qrUrl} alt="QR" style={{ width: 72, height: 72 }} />
            <p style={{ fontSize: 8, color: "#94a3b8", marginTop: 2 }}>
              Escanea y compra
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Horizontal label (banner style) ── */
const HorizontalLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);

  return (
    <div
      id="label-preview-inner"
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{
        width: 560,
        height: 360,
        background: BRAND.dark,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Left image */}
      <div className="absolute inset-y-0 left-0 w-[200px]">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <Tag size={48} className="text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0F172A]" />
      </div>

      {/* Right content */}
      <div className="absolute left-[210px] right-0 top-0 bottom-0 flex flex-col justify-between p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p
              className="font-black text-xs tracking-widest uppercase"
              style={{ color: BRAND.color }}
            >
              {BRAND.name}
            </p>
            <p className="text-slate-500 text-[9px]">{BRAND.tagline}</p>
          </div>
          <span className="text-[10px] font-mono text-slate-600 bg-slate-800/60 px-2 py-0.5 rounded">
            {product?.sku}
          </span>
        </div>

        {/* Name + category */}
        <div>
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">
            {product?.category}
          </p>
          <h2 className="text-white font-black text-2xl leading-tight mt-1">
            {product?.name}
          </h2>
          {product?.description && (
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center gap-4">
          {salePrice ? (
            <>
              <div>
                <p className="text-slate-500 text-sm line-through">
                  S/ {price.toFixed(2)}
                </p>
                <p className="font-black text-3xl text-rose-400 leading-none">
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
              {discount > 0 && (
                <div
                  className="rounded-full px-3 py-2 font-black text-sm text-slate-900"
                  style={{ background: BRAND.color }}
                >
                  -{discount}%
                </div>
              )}
            </>
          ) : (
            <p
              className="font-black text-3xl leading-none"
              style={{ color: BRAND.color }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between pt-3 border-t border-slate-800">
          <div>
            <p className="text-[9px] text-slate-500">
              {BRAND.web} · {BRAND.phone}
            </p>
          </div>
          {qrUrl && (
            <div className="flex items-center gap-2">
              <img
                src={qrUrl}
                alt="QR"
                style={{
                  width: 56,
                  height: 56,
                  background: "white",
                  padding: 3,
                  borderRadius: 6,
                }}
              />
              <p className="text-[9px] text-slate-500 max-w-[60px] text-right">
                Escanea y compra
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════
   LABEL RENDERER MAP
   ══════════════════════════════════════════ */
const RENDERERS = {
  small: SmallLabel,
  medium: MediumLabel,
  premium: PremiumLabel,
  a4: A4Label,
  horizontal: HorizontalLabel,
};

/* ══════════════════════════════════════════
   PDF EXPORT
   ══════════════════════════════════════════ */
async function exportLabelPDF(product, format, qrUrl) {
  const { default: jsPDF } = await import("jspdf");
  const fmt = FORMATS.find((f) => f.id === format) || FORMATS[0];

  // Points = pixels * 0.75 (approx for screen → PDF mapping at 96 dpi)
  const scale = 0.75;
  const pw = fmt.w * scale;
  const ph = fmt.h * scale;

  const doc = new jsPDF({
    orientation: pw > ph ? "l" : "p",
    unit: "pt",
    format: [pw, ph],
  });

  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);

  /* Background */
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, ph, "F");

  /* Product image (if any) — top area */
  const imgH = ph * 0.4;
  if (img) {
    try {
      doc.addImage(img, "JPEG", 0, 0, pw, imgH, undefined, "FAST");
    } catch {
      // skip if CORS or format issue
    }
  }

  /* Gradient overlay (simulate with semi-transparent rect) */
  doc.setFillColor(15, 23, 42);
  doc.setGState(new doc.GState({ opacity: 0.6 }));
  doc.rect(0, imgH * 0.5, pw, imgH * 0.5, "F");
  doc.setGState(new doc.GState({ opacity: 1 }));

  let y = imgH + 12;

  /* Brand */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(207, 174, 112);
  doc.text(BRAND.name.toUpperCase(), 14, y);
  y += 14;

  /* Category */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    (product?.category || "") +
      (product?.subcategory ? ` / ${product.subcategory}` : ""),
    14,
    y,
  );
  y += 13;

  /* Product name */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(248, 250, 252);
  const nameLines = doc.splitTextToSize(product?.name || "", pw - 28);
  doc.text(nameLines, 14, y);
  y += nameLines.length * 16 + 6;

  /* SKU */
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`SKU: ${product?.sku || "—"}`, 14, y);
  y += 14;

  /* Price block */
  doc.setFillColor(25, 37, 60);
  doc.roundedRect(14, y, pw - 28, 36, 4, 4, "F");
  if (salePrice) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`S/ ${price.toFixed(2)}`, 22, y + 12);
    doc.setDrawColor(148, 163, 184);
    doc.line(22, y + 9, 22 + doc.getTextWidth(`S/ ${price.toFixed(2)}`), y + 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(251, 113, 133);
    doc.text(`S/ ${salePrice.toFixed(2)}`, 22, y + 28);
    if (discount > 0) {
      doc.setFillColor(207, 174, 112);
      doc.roundedRect(pw - 52, y + 8, 34, 18, 9, 9, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`-${discount}%`, pw - 50, y + 20);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(207, 174, 112);
    doc.text(`S/ ${price.toFixed(2)}`, 22, y + 26);
  }
  y += 46;

  /* Spec badges */
  const specs = [
    product?.dimensions ||
      (product?.length && product?.width
        ? `${product.length}×${product.width} cm`
        : null),
    product?.unitsPerBox ? `${product.unitsPerBox} u/caja` : null,
  ].filter(Boolean);
  if (specs.length) {
    let bx = 14;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    specs.forEach((spec) => {
      const tw = doc.getTextWidth(spec) + 12;
      doc.setFillColor(30, 41, 59);
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(bx, y, tw, 14, 3, 3, "FD");
      doc.setTextColor(203, 213, 225);
      doc.text(spec, bx + 6, y + 9.5);
      bx += tw + 6;
    });
    y += 22;
  }

  /* QR code */
  if (qrUrl) {
    const qrSize = 56;
    const qrX = pw - 14 - qrSize;
    const qrY = ph - 14 - qrSize - 12;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 4, 4, "F");
    doc.addImage(qrUrl, "PNG", qrX, qrY, qrSize, qrSize);
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Escanea y compra", qrX, qrY + qrSize + 9);
  }

  /* Footer line */
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.5);
  doc.line(14, ph - 22, pw - 14, ph - 22);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${BRAND.web}  ·  ${BRAND.phone}  ·  ${BRAND.ig}`, 14, ph - 10);

  doc.save(`etiqueta-${product?.sku || product?.id || "producto"}.pdf`);
}

/* ══════════════════════════════════════════
   PNG EXPORT (canvas)
   ══════════════════════════════════════════ */
async function exportLabelPNG(labelRef) {
  const node = labelRef.current?.querySelector("#label-preview-inner");
  if (!node) return;
  // Use html2canvas if available, otherwise fallback to a placeholder
  try {
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });
    const link = document.createElement("a");
    link.download = "etiqueta.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch {
    alert("Para exportar PNG instala html2canvas: npm install html2canvas");
  }
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════ */
const ProductLabel = ({ product, onClose }) => {
  const [format, setFormat] = useState("medium");
  const [qrUrl, setQrUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const labelRef = useRef(null);

  /* Generate QR on mount and when product changes */
  useEffect(() => {
    if (!product?.id) return;
    generateProductQR(product.slug, product.id, {
      dark: "#0F172A",
      light: "#FFFFFF",
      width: 300,
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [product?.id, product?.slug]);

  const LabelComp = RENDERERS[format] || RENDERERS.medium;
  const productUrl = getProductPublicUrl(product?.slug, product?.id);

  const handlePrint = () => {
    const node = labelRef.current?.querySelector("#label-preview-inner");
    if (!node) return;
    const printWindow = window.open("", "_blank", "width=700,height=900");
    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta — ${product?.name}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet" />
          <style>
            @page { margin: 10mm; }
            body { margin: 0; display: flex; justify-content: center; align-items: flex-start; padding: 10px; background: white; }
            img { max-width: 100%; }
          </style>
        </head>
        <body>
          ${node.outerHTML}
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(productUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePDF = async () => {
    setLoading(true);
    try {
      await exportLabelPDF(product, format, qrUrl);
    } finally {
      setLoading(false);
    }
  };

  const handlePNG = async () => {
    setLoading(true);
    try {
      await exportLabelPNG(labelRef);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 bg-black/80 backdrop-blur-sm">
      <div className="relative bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Tag size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">
                Etiqueta de Producto
              </h2>
              <p className="text-slate-500 text-xs truncate max-w-[200px] sm:max-w-[340px]">
                {product?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Sidebar: controls */}
          <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
            {/* Format selector */}
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers size={13} /> Formato
              </p>
              <div className="flex flex-col gap-1.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      format === f.id
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span className="font-semibold">{f.label}</span>
                    <span className="text-xs opacity-70">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* QR info */}
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                <QrCode size={13} /> URL del QR
              </p>
              <div className="rounded-lg bg-slate-800 p-2.5 flex flex-col gap-2">
                <p className="text-slate-400 text-[10px] break-all font-mono leading-relaxed">
                  {productUrl}
                </p>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  {copied ? <Check size={12} /> : null}
                  {copied ? "¡Copiado!" : "Copiar URL"}
                </button>
              </div>
            </div>

            {/* Product info summary */}
            <div className="rounded-xl bg-slate-800/50 border border-slate-800 p-3 text-[11px] space-y-1.5">
              <p className="text-slate-400">
                <span className="text-slate-300 font-semibold">SKU:</span>{" "}
                {product?.sku || "—"}
              </p>
              <p className="text-slate-400">
                <span className="text-slate-300 font-semibold">Precio:</span> S/{" "}
                {getPrice(product).toFixed(2)}
              </p>
              {getSalePrice(product) && (
                <p className="text-slate-400">
                  <span className="text-rose-400 font-semibold">Oferta:</span>{" "}
                  S/ {getSalePrice(product).toFixed(2)}
                </p>
              )}
              <p className="text-slate-400">
                <span className="text-slate-300 font-semibold">Stock:</span>{" "}
                {product?.stock || product?.currentStock || 0}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
              >
                <Printer size={16} /> Imprimir
              </button>
              <button
                onClick={handlePDF}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                <FileText size={16} /> {loading ? "Generando…" : "Exportar PDF"}
              </button>
              <button
                onClick={handlePNG}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                <Download size={16} /> Exportar PNG
              </button>
            </div>
          </div>

          {/* Preview */}
          <div
            ref={labelRef}
            className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[#0a0f1e] min-h-[400px]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, #1e293b22 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            <div className="shadow-2xl">
              <LabelComp product={product} qrUrl={qrUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductLabel;
