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
  { id: "medium", label: "Mediana", desc: "Exhibición", w: 320, h: 480 },
  { id: "small", label: "Pequeña", desc: "Estantería", w: 300, h: 200 },
  { id: "premium", label: "Premium", desc: "Showroom", w: 400, h: 680 },
  { id: "a4", label: "A4 Vertical", desc: "Impresión", w: 420, h: 594 },
  { id: "horizontal", label: "Horizontal", desc: "Banner", w: 560, h: 360 },
];

/* ── Brand config ── */
const BRAND = {
  name: "JIEDA",
  tagline: "Acabados & Construcción",
  web: "www.jieda.pe",
  phone: "+51 919 066 888",
  ig: "@jiedastore",
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
function getWholesalePrice(product) {
  return Number(product?.wholesalePrice || 0);
}
function getWholesaleInfo(product) {
  const price = getWholesalePrice(product);
  if (!price) return null;
  return {
    price,
    threshold: product?.wholesaleThreshold || null,
    unit: product?.wholesaleThresholdUnit || "und",
  };
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
      className="relative overflow-hidden"
      style={{
        width: 300,
        height: 200,
        background: "linear-gradient(135deg, #0F172A 60%, #1e2d45)",
        fontFamily: "Inter, sans-serif",
        borderRadius: 14,
        border: `1.5px solid ${BRAND.color}55`,
        boxShadow: `0 0 24px ${BRAND.color}22`,
      }}
    >
      {/* Gold left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: `linear-gradient(to bottom, ${BRAND.color}, ${BRAND.color}88)`,
          borderRadius: "14px 0 0 14px",
        }}
      />

      {/* Product image */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 110,
          overflow: "hidden",
        }}
      >
        {getImage(product) ? (
          <img
            src={getImage(product)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tag size={28} color="#334155" />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, #0F172A 10%, transparent 60%)",
          }}
        />
      </div>

      {/* Discount badge */}
      {discount > 0 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "#f43f5e",
            color: "white",
            borderRadius: 99,
            padding: "3px 8px",
            fontSize: 9,
            fontWeight: 900,
            zIndex: 2,
            letterSpacing: 0.5,
          }}
        >
          -{discount}% OFF
        </div>
      )}

      {/* Info */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 0,
          bottom: 0,
          right: 110,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "14px 8px 14px 8px",
        }}
      >
        <div>
          <p
            style={{
              color: BRAND.color,
              fontSize: 7,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 4,
            }}
          >
            {BRAND.name}
          </p>
          <p
            style={{
              color: "#f8fafc",
              fontWeight: 900,
              fontSize: 12,
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product?.name}
          </p>
          {product?.category && (
            <span
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 8,
                fontWeight: 700,
                color: BRAND.color,
                background: `${BRAND.color}18`,
                border: `1px solid ${BRAND.color}44`,
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              {product.category}
            </span>
          )}
        </div>
        <div>
          {salePrice ? (
            <>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: 9,
                  textDecoration: "line-through",
                  lineHeight: 1,
                }}
              >
                S/ {price.toFixed(2)}
              </p>
              <p
                style={{
                  color: "#fb7185",
                  fontWeight: 900,
                  fontSize: 20,
                  lineHeight: 1.1,
                }}
              >
                S/ {salePrice.toFixed(2)}
              </p>
            </>
          ) : (
            <p
              style={{
                color: BRAND.color,
                fontWeight: 900,
                fontSize: 22,
                lineHeight: 1.1,
              }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
          <p
            style={{
              color: "#475569",
              fontSize: 8,
              fontFamily: "monospace",
              marginTop: 3,
            }}
          >
            {product?.sku}
          </p>
        </div>
        {qrUrl && (
          <img
            src={qrUrl}
            alt="QR"
            style={{
              position: "absolute",
              bottom: 10,
              right: -90,
              width: 36,
              height: 36,
              background: "white",
              padding: 2,
              borderRadius: 4,
            }}
          />
        )}
      </div>
    </div>
  );
};

/* ── Medium label — diseño limpio tipo catálogo ── */
const MediumLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);
  const wholesale = getWholesaleInfo(product);
  const C = BRAND.color; // #CFAE70 dorado
  const DARK = BRAND.dark; // #0F172A navy

  return (
    <div
      id="label-preview-inner"
      style={{
        width: 320,
        height: 480,
        background: "#FFFFFF",
        fontFamily: "Inter, sans-serif",
        borderRadius: 20,
        overflow: "hidden",
        border: "1.5px solid #E2ECF4",
        boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── ZONA 1: HEADER con logo + nombre de producto ── */}
      <div
        style={{
          background: DARK,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Logo cuadrado */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: `${C}1A`,
            border: `2px solid ${C}66`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img
            src="/img/brand/logo-jieda.png"
            alt={BRAND.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              padding: 4,
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {/* Marca + nombre producto */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              color: `${C}CC`,
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              marginBottom: 4,
              lineHeight: 1,
            }}
          >
            {product?.brand || BRAND.name}
          </p>
          <p
            style={{
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: 14,
              lineHeight: 1.25,
              wordBreak: "break-word",
            }}
          >
            {product?.name}
          </p>
        </div>
        {/* Badge descuento */}
        {discount > 0 && (
          <div
            style={{
              background: "#EF4444",
              color: "white",
              borderRadius: 99,
              padding: "4px 9px",
              fontSize: 9,
              fontWeight: 900,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            -{discount}%
          </div>
        )}
      </div>

      {/* ── ZONA 2: CATEGORÍA PILL ── */}
      <div
        style={{
          background: "#F4F7FB",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {product?.category && (
          <span
            style={{
              background: `${C}28`,
              color: DARK,
              border: `1px solid ${C}55`,
              borderRadius: 99,
              padding: "4px 18px",
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {product.category}
            {product?.subcategory ? ` · ${product.subcategory}` : ""}
          </span>
        )}
      </div>

      {/* ── ZONA 3: IMAGEN DEL PRODUCTO ── */}
      <div
        style={{
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          minHeight: 0,
          padding: "10px 16px",
        }}
      >
        {img ? (
          <img
            src={img}
            alt=""
            style={{
              maxHeight: "100%",
              maxWidth: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Tag size={40} color="#CBD5E1" />
            <p
              style={{
                fontSize: 8,
                color: "#94A3B8",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Sin imagen
            </p>
          </div>
        )}
      </div>

      {/* ── ZONA 4: SKU / EAN ── */}
      <div
        style={{
          background: "#F4F7FB",
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderTop: "1px solid #E2ECF4",
          borderBottom: "1px solid #E2ECF4",
        }}
      >
        <p
          style={{
            color: "#94A3B8",
            fontSize: 8.5,
            fontFamily: "monospace",
            letterSpacing: 0.3,
          }}
        >
          SKU: {product?.sku || "—"}
          {product?.ean ? `  ·  EAN: ${product.ean}` : ""}
        </p>
      </div>

      {/* ── ZONA 5: PRECIOS ── */}
      <div
        style={{
          background: "#FFFFFF",
          display: "grid",
          gridTemplateColumns: wholesale ? "1fr 1fr" : "1fr",
          padding: "10px 16px 8px",
          flexShrink: 0,
        }}
      >
        {/* Precio unitario */}
        <div
          style={{
            paddingRight: wholesale ? 12 : 0,
            borderRight: wholesale ? "1px solid #E2ECF4" : "none",
          }}
        >
          <p
            style={{
              color: "#94A3B8",
              fontSize: 7.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 2,
            }}
          >
            Unitario
          </p>
          {salePrice ? (
            <>
              <p
                style={{
                  color: "#94A3B8",
                  fontSize: 10,
                  textDecoration: "line-through",
                  lineHeight: 1,
                }}
              >
                S/ {price.toFixed(2)}
              </p>
              <p
                style={{
                  color: "#EF4444",
                  fontWeight: 900,
                  fontSize: 22,
                  lineHeight: 1.15,
                }}
              >
                S/ {salePrice.toFixed(2)}
              </p>
            </>
          ) : (
            <p
              style={{
                color: DARK,
                fontWeight: 900,
                fontSize: 22,
                lineHeight: 1.15,
              }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>
        {/* Precio mayorista */}
        {wholesale && (
          <div style={{ paddingLeft: 12 }}>
            <p
              style={{
                color: "#94A3B8",
                fontSize: 7.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 2,
              }}
            >
              Por Mayor
            </p>
            <p
              style={{
                color: "#16A34A",
                fontWeight: 900,
                fontSize: 22,
                lineHeight: 1.15,
              }}
            >
              S/ {wholesale.price.toFixed(2)}
            </p>
            {wholesale.threshold && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 3,
                  background: "#DCFCE7",
                  color: "#16A34A",
                  borderRadius: 99,
                  padding: "2px 8px",
                  fontSize: 7.5,
                  fontWeight: 700,
                }}
              >
                mín. {wholesale.threshold} {wholesale.unit}.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── ZONA 6: FOOTER — "Escanea y compra" + QR ── */}
      <div
        style={{
          borderTop: "1px solid #E2ECF4",
          background: "#F4F7FB",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <p style={{ color: "#94A3B8", fontSize: 8.5, fontWeight: 600 }}>
          Escanea y compra
        </p>
        {qrUrl && (
          <div
            style={{
              background: "white",
              padding: 3,
              borderRadius: 8,
              border: `1.5px solid ${C}55`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <img
              src={qrUrl}
              alt="QR"
              style={{ width: 100, height: 100, display: "block" }}
            />
          </div>
        )}
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
      style={{
        width: 400,
        height: 680,
        background: "#060d1a",
        fontFamily: "Inter, sans-serif",
        borderRadius: 20,
        overflow: "hidden",
        border: `2px solid ${BRAND.color}55`,
        boxShadow: `0 0 60px ${BRAND.color}22, inset 0 0 80px rgba(0,0,0,0.3)`,
        position: "relative",
      }}
    >
      {/* Top accent glow line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(to right, transparent, ${BRAND.color}, transparent)`,
        }}
      />

      {/* Full bleed image */}
      <div style={{ position: "relative", height: 310, overflow: "hidden" }}>
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
              background: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tag size={56} color="#1f2937" />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 40%, #060d1a 100%)",
          }}
        />
        {/* Brand header */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 18,
            right: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p
              style={{
                color: BRAND.color,
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {BRAND.name}
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 8,
                letterSpacing: 1,
              }}
            >
              {BRAND.tagline}
            </p>
          </div>
          {discount > 0 && (
            <div
              style={{
                background: `linear-gradient(135deg, ${BRAND.color}, #e8c97a)`,
                borderRadius: 12,
                padding: "8px 14px",
                textAlign: "center",
                boxShadow: `0 4px 20px ${BRAND.color}55`,
              }}
            >
              <p
                style={{
                  color: BRAND.dark,
                  fontWeight: 900,
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                -{discount}%
              </p>
              <p
                style={{
                  color: BRAND.dark,
                  fontSize: 7,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                OFERTA
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Category & SKU row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              color: "#64748b",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {product?.category}
            {product?.subcategory ? ` / ${product.subcategory}` : ""}
          </span>
          <span
            style={{
              color: "#475569",
              fontSize: 9,
              fontFamily: "monospace",
              background: "#111827",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {product?.sku}
          </span>
        </div>

        {/* Name */}
        <h2
          style={{
            color: "#f8fafc",
            fontWeight: 900,
            fontSize: 24,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {product?.name}
        </h2>

        {/* Description */}
        {product?.description && (
          <p
            style={{
              color: "#475569",
              fontSize: 10,
              lineHeight: 1.6,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </p>
        )}

        {/* Price block */}
        <div
          style={{
            background: `linear-gradient(135deg, ${BRAND.color}14 0%, rgba(30,41,59,0.8) 100%)`,
            border: `1px solid ${BRAND.color}33`,
            borderRadius: 16,
            padding: "16px 18px",
          }}
        >
          {salePrice ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: 11,
                    textDecoration: "line-through",
                  }}
                >
                  S/ {price.toFixed(2)}
                </p>
                <p
                  style={{
                    color: "#fb7185",
                    fontWeight: 900,
                    fontSize: 40,
                    lineHeight: 1,
                    textShadow: "0 0 20px rgba(251,113,133,0.3)",
                  }}
                >
                  S/ {salePrice.toFixed(2)}
                </p>
                <p style={{ color: "#f87171", fontSize: 9, marginTop: 3 }}>
                  Precio especial de oferta
                </p>
              </div>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${BRAND.color}, #e8c97a)`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 6px 24px ${BRAND.color}44`,
                }}
              >
                <span
                  style={{
                    color: BRAND.dark,
                    fontWeight: 900,
                    fontSize: 15,
                    lineHeight: 1,
                  }}
                >
                  -{discount}%
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p
                style={{
                  color: "#64748b",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Precio por unidad
              </p>
              <p
                style={{
                  color: BRAND.color,
                  fontWeight: 900,
                  fontSize: 40,
                  lineHeight: 1.1,
                  textShadow: `0 0 24px ${BRAND.color}44`,
                }}
              >
                S/ {price.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Spec grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
          }}
        >
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
                style={{
                  background: "#111827",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: "6px 8px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#94a3b8", fontSize: 9, fontWeight: 700 }}>
                  {spec}
                </p>
              </div>
            ))}
        </div>

        {/* QR + footer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: 10,
            borderTop: `1px solid ${BRAND.color}22`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <p style={{ color: "#64748b", fontSize: 9, fontWeight: 600 }}>
              {BRAND.web}
            </p>
            <p style={{ color: "#334155", fontSize: 8 }}>{BRAND.phone}</p>
            <p style={{ color: "#334155", fontSize: 8 }}>{BRAND.ig}</p>
          </div>
          {qrUrl && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: 5,
                  borderRadius: 10,
                  boxShadow: `0 0 18px ${BRAND.color}44`,
                }}
              >
                <img
                  src={qrUrl}
                  alt="QR"
                  style={{ width: 68, height: 68, display: "block" }}
                />
              </div>
              <p style={{ color: "#475569", fontSize: 8 }}>Escanea y compra</p>
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
        borderRadius: 16,
        overflow: "hidden",
        border: "1.5px solid #e2e8f0",
        boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
        position: "relative",
      }}
    >
      {/* Top gold accent bar */}
      <div
        style={{
          height: 6,
          background: `linear-gradient(to right, ${BRAND.dark}, ${BRAND.color}, ${BRAND.dark})`,
        }}
      />

      {/* Header */}
      <div
        style={{
          background: BRAND.dark,
          padding: "14px 22px",
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
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {BRAND.name}
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 9,
              marginTop: 1,
            }}
          >
            {BRAND.tagline}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 8,
              fontFamily: "monospace",
            }}
          >
            {product?.sku}
          </p>
          {product?.category && (
            <span
              style={{
                display: "inline-block",
                marginTop: 3,
                fontSize: 8,
                fontWeight: 700,
                color: BRAND.dark,
                background: BRAND.color,
                borderRadius: 4,
                padding: "2px 7px",
              }}
            >
              {product.category}
            </span>
          )}
        </div>
      </div>

      {/* Product image */}
      <div style={{ height: 210, position: "relative", overflow: "hidden" }}>
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
        {/* Bottom gradient */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: "linear-gradient(to top, white, transparent)",
          }}
        />
        {discount > 0 && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "#f43f5e",
              color: "white",
              borderRadius: 99,
              padding: "5px 14px",
              fontWeight: 900,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(244,63,94,0.4)",
            }}
          >
            -{discount}% OFF
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "14px 22px" }}>
        <p
          style={{
            color: "#94a3b8",
            fontSize: 9,
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
            margin: "4px 0 12px",
          }}
        >
          {product?.name}
        </h2>

        {/* Price block */}
        <div
          style={{
            background: BRAND.dark,
            borderRadius: 14,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {salePrice ? (
            <>
              <div>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: 11,
                    textDecoration: "line-through",
                  }}
                >
                  S/ {price.toFixed(2)}
                </p>
                <p
                  style={{
                    color: "#fb7185",
                    fontWeight: 900,
                    fontSize: 30,
                    lineHeight: 1,
                  }}
                >
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${BRAND.color}, #e8c97a)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 13,
                  color: BRAND.dark,
                  boxShadow: `0 4px 16px ${BRAND.color}44`,
                }}
              >
                -{discount}%
              </div>
            </>
          ) : (
            <p
              style={{
                color: BRAND.color,
                fontWeight: 900,
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Specs */}
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}
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
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "4px 10px",
                  fontSize: 9,
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
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: `3px solid ${BRAND.color}`,
          padding: "10px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc",
        }}
      >
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>
            {BRAND.web}
          </p>
          <p style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>{url}</p>
        </div>
        {qrUrl && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                background: "white",
                padding: 3,
                borderRadius: 8,
                border: `2px solid ${BRAND.color}44`,
                display: "inline-block",
              }}
            >
              <img
                src={qrUrl}
                alt="QR"
                style={{ width: 64, height: 64, display: "block" }}
              />
            </div>
            <p style={{ fontSize: 7, color: "#94a3b8", marginTop: 2 }}>
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
      style={{
        width: 560,
        height: 360,
        background: "#060d1a",
        fontFamily: "Inter, sans-serif",
        borderRadius: 20,
        overflow: "hidden",
        border: `1.5px solid ${BRAND.color}44`,
        boxShadow: `0 0 50px ${BRAND.color}18`,
        position: "relative",
        display: "flex",
      }}
    >
      {/* Left image panel */}
      <div
        style={{
          width: 210,
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
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
              background: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Tag size={48} color="#1f2937" />
          </div>
        )}
        {/* Diagonal gradient divider */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, transparent 50%, #060d1a 100%)",
          }}
        />
        {/* Top-left brand strip */}
        <div style={{ position: "absolute", top: 16, left: 14 }}>
          <div
            style={{
              background: `${BRAND.color}ee`,
              borderRadius: 6,
              padding: "3px 10px",
            }}
          >
            <span
              style={{
                color: BRAND.dark,
                fontWeight: 900,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {BRAND.name}
            </span>
          </div>
        </div>
        {discount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 14,
              background: "#f43f5e",
              color: "white",
              borderRadius: 99,
              padding: "4px 12px",
              fontWeight: 900,
              fontSize: 10,
              boxShadow: "0 4px 12px rgba(244,63,94,0.45)",
            }}
          >
            -{discount}% OFF
          </div>
        )}
      </div>

      {/* Right content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "20px 22px",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                color: "#475569",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: 2,
                fontWeight: 700,
              }}
            >
              {product?.category}
            </p>
            <h2
              style={{
                color: "#f8fafc",
                fontWeight: 900,
                fontSize: 22,
                lineHeight: 1.2,
                margin: "3px 0",
              }}
            >
              {product?.name}
            </h2>
          </div>
          <span
            style={{
              color: "#334155",
              fontSize: 8,
              fontFamily: "monospace",
              background: "#111827",
              padding: "3px 7px",
              borderRadius: 4,
              marginLeft: 8,
              flexShrink: 0,
            }}
          >
            {product?.sku}
          </span>
        </div>

        {/* Description */}
        {product?.description && (
          <p
            style={{
              color: "#475569",
              fontSize: 10,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </p>
        )}

        {/* Price */}
        <div
          style={{
            background: `linear-gradient(135deg, ${BRAND.color}12, transparent)`,
            border: `1px solid ${BRAND.color}33`,
            borderRadius: 14,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {salePrice ? (
            <>
              <div>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: 10,
                    textDecoration: "line-through",
                  }}
                >
                  S/ {price.toFixed(2)}
                </p>
                <p
                  style={{
                    color: "#fb7185",
                    fontWeight: 900,
                    fontSize: 28,
                    lineHeight: 1,
                    textShadow: "0 0 16px rgba(251,113,133,0.3)",
                  }}
                >
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
              {discount > 0 && (
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${BRAND.color}, #e8c97a)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 12,
                    color: BRAND.dark,
                    boxShadow: `0 4px 16px ${BRAND.color}44`,
                  }}
                >
                  -{discount}%
                </div>
              )}
            </>
          ) : (
            <p
              style={{
                color: BRAND.color,
                fontWeight: 900,
                fontSize: 30,
                lineHeight: 1,
                textShadow: `0 0 20px ${BRAND.color}33`,
              }}
            >
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingTop: 10,
            borderTop: `1px solid ${BRAND.color}22`,
          }}
        >
          <p style={{ color: "#334155", fontSize: 8 }}>
            {BRAND.web} · {BRAND.phone}
          </p>
          {qrUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  background: "white",
                  padding: 3,
                  borderRadius: 7,
                  boxShadow: `0 0 12px ${BRAND.color}33`,
                }}
              >
                <img
                  src={qrUrl}
                  alt="QR"
                  style={{ width: 50, height: 50, display: "block" }}
                />
              </div>
              <p
                style={{
                  color: "#475569",
                  fontSize: 8,
                  maxWidth: 50,
                  textAlign: "right",
                  lineHeight: 1.4,
                }}
              >
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

async function urlToBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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
  const imgSrc = getImage(product);

  /* Pre-fetch images as base64 to avoid CORS issues with jsPDF */
  const [imgData, qrData] = await Promise.all([
    imgSrc ? urlToBase64(imgSrc) : Promise.resolve(null),
    qrUrl ? urlToBase64(qrUrl) : Promise.resolve(null),
  ]);

  /* Background */
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, ph, "F");

  /* Product image (if any) — top area */
  const imgH = ph * 0.4;
  if (imgData) {
    try {
      doc.addImage(imgData, "JPEG", 0, 0, pw, imgH, undefined, "FAST");
    } catch {
      // skip if format issue
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
  if (qrData) {
    const qrSize = 56;
    const qrX = pw - 14 - qrSize;
    const qrY = ph - 14 - qrSize - 12;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 4, 4, "F");
    doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);
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
