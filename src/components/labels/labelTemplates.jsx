/**
 * labelTemplates — shared label design components.
 *
 * Used by both the single-product preview (ProductLabel.jsx) and the
 * batch operations (PrintCenter.jsx) so every surface renders the exact
 * same professional designs, respects the chosen format, and always
 * includes a working QR code. Non-component helpers (constants, PDF
 * export) live in labelData.js so this file stays Fast-Refresh friendly.
 */
import { Tag } from "lucide-react";
import {
  BRAND,
  getDiscount,
  getImage,
  getPrice,
  getSalePrice,
  getWholesaleInfo,
} from "./labelData";

/**
 * FramedImage — a bounded, neutral (white) photo panel with rounded corners,
 * a border and a soft shadow. Product photos are almost always shot on a
 * white background, so a white backdrop lets them sit flush with no visible
 * seam; a colored or plain photo still reads as an intentional framed photo
 * instead of a stray full-bleed color block. Used by every format so photos
 * never fight with the dark showroom theme around them.
 */
const FramedImage = ({ src, width, height, radius = 14, discount }) => (
  <div style={{ position: "relative", width, height, flexShrink: 0 }}>
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: radius,
        overflow: "hidden",
        background: "#FFFFFF",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Tag size={Math.min(width, height) * 0.28} color="#CBD5E1" />
      )}
    </div>
    {discount > 0 && (
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "#f43f5e",
          color: "white",
          borderRadius: 99,
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.3,
          boxShadow: "0 4px 12px rgba(244,63,94,0.5)",
        }}
      >
        -{discount}% OFF
      </div>
    )}
  </div>
);

/** True when the description is just a restatement of the product name. */
const hasOwnDescription = (product) => {
  const desc = (product?.description || "").trim();
  const name = (product?.name || "").trim();
  return desc.length > 0 && desc.toLowerCase() !== name.toLowerCase();
};

/* ══════════════════════════════════════════
   LABEL PREVIEW COMPONENTS
   ══════════════════════════════════════════ */

/* ── Small label (shelf tag) — foto en marco contenido, QR sin superponer ── */
export const SmallLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);

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
        display: "flex",
      }}
    >
      {/* Gold left accent bar */}
      <div
        style={{
          width: 4,
          flexShrink: 0,
          background: `linear-gradient(to bottom, ${BRAND.color}, ${BRAND.color}88)`,
        }}
      />

      {/* Left: brand, name, category, price + QR */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "12px 10px 12px 12px",
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

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
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
                    fontSize: 19,
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
                  fontSize: 20,
                  lineHeight: 1.1,
                }}
              >
                S/ {price.toFixed(2)}
              </p>
            )}
            <p
              style={{
                color: "#475569",
                fontSize: 7.5,
                fontFamily: "monospace",
                marginTop: 3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {product?.sku}
            </p>
          </div>

          {qrUrl && (
            <div
              style={{
                flexShrink: 0,
                background: "white",
                padding: 2.5,
                borderRadius: 6,
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              <img src={qrUrl} alt="QR" style={{ width: 38, height: 38, display: "block" }} />
            </div>
          )}
        </div>
      </div>

      {/* Right: framed thumbnail — bounded so a flat/plain photo still reads as an intentional photo tile */}
      <div
        style={{
          width: 88,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 10px 10px 0",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 10,
            overflow: "hidden",
            background: "#0b1424",
            border: `1px solid ${BRAND.color}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {img ? (
            <img
              src={img}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Tag size={22} color="#334155" />
          )}
        </div>

        {discount > 0 && (
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              background: "#f43f5e",
              color: "white",
              borderRadius: 99,
              padding: "2px 6px",
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.3,
              boxShadow: "0 2px 6px rgba(244,63,94,0.5)",
            }}
          >
            -{discount}%
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Medium label — diseño limpio tipo catálogo ── */
export const MediumLabel = ({ product, qrUrl }) => {
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
            src="/img/brand/logo-dechy.png"
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

/* ── Premium label (showroom) — foto enmarcada + contenido que llena el alto real ── */
export const PremiumLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);
  const showDescription = hasOwnDescription(product);

  const specs = [
    product?.dimensions ||
      (product?.length && product?.width ? `${product.length}×${product.width} cm` : null),
    product?.unitsPerBox ? `${product.unitsPerBox} u/caja` : null,
  ].filter(Boolean);

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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top accent glow line */}
      <div
        style={{
          height: 2,
          flexShrink: 0,
          background: `linear-gradient(to right, transparent, ${BRAND.color}, transparent)`,
        }}
      />

      {/* Brand header */}
      <div
        style={{
          padding: "18px 22px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexShrink: 0,
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
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, letterSpacing: 1 }}>
            {BRAND.tagline}
          </p>
        </div>
        <span
          style={{
            color: "#94a3b8",
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

      {/* Framed photo — bounded so it never fights the dark theme */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "16px 22px 0" }}>
        <FramedImage src={img} width={356} height={252} discount={discount} />
      </div>

      {/* Middle: absorbs whatever space is left, so short content never leaves a dead gap */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
          padding: "16px 22px",
        }}
      >
        <div>
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
          <h2
            style={{
              color: "#f8fafc",
              fontWeight: 900,
              fontSize: 22,
              lineHeight: 1.2,
              margin: "4px 0 0",
            }}
          >
            {product?.name}
          </h2>
          {showDescription && (
            <p
              style={{
                color: "#64748b",
                fontSize: 10,
                lineHeight: 1.6,
                margin: "6px 0 0",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </p>
          )}
        </div>

        {/* Price block */}
        <div
          style={{
            background: `linear-gradient(135deg, ${BRAND.color}14 0%, rgba(30,41,59,0.8) 100%)`,
            border: `1px solid ${BRAND.color}33`,
            borderRadius: 16,
            padding: "14px 18px",
          }}
        >
          {salePrice ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ color: "#64748b", fontSize: 11, textDecoration: "line-through" }}>
                  S/ {price.toFixed(2)}
                </p>
                <p
                  style={{
                    color: "#fb7185",
                    fontWeight: 900,
                    fontSize: 34,
                    lineHeight: 1,
                    textShadow: "0 0 20px rgba(251,113,133,0.3)",
                  }}
                >
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${BRAND.color}, #e8c97a)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 6px 24px ${BRAND.color}44`,
                }}
              >
                <span style={{ color: BRAND.dark, fontWeight: 900, fontSize: 13 }}>
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
                  fontSize: 34,
                  lineHeight: 1.1,
                  textShadow: `0 0 24px ${BRAND.color}44`,
                }}
              >
                S/ {price.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Spec badges (only rendered when there's something real to show) */}
        {specs.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {specs.map((spec, i) => (
              <div
                key={i}
                style={{
                  background: "#111827",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: "6px 10px",
                }}
              >
                <p style={{ color: "#94a3b8", fontSize: 9, fontWeight: 700 }}>{spec}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — always pinned to the bottom edge */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "14px 22px 20px",
          borderTop: `1px solid ${BRAND.color}22`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ color: "#64748b", fontSize: 9, fontWeight: 600 }}>{BRAND.web}</p>
          <p style={{ color: "#334155", fontSize: 8 }}>{BRAND.phone}</p>
          <p style={{ color: "#334155", fontSize: 8 }}>{BRAND.ig}</p>
        </div>
        {qrUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div
              style={{
                background: "white",
                padding: 5,
                borderRadius: 10,
                boxShadow: `0 0 18px ${BRAND.color}44`,
              }}
            >
              <img src={qrUrl} alt="QR" style={{ width: 64, height: 64, display: "block" }} />
            </div>
            <p style={{ color: "#475569", fontSize: 8 }}>Escanea y compra</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── A4 vertical label — foto enmarcada, sin datos repetidos ── */
export const A4Label = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);
  const showDescription = hasOwnDescription(product);

  const specs = [
    product?.dimensions ||
      (product?.length && product?.width ? `${product.length}×${product.width} cm` : null),
    product?.unitsPerBox ? `${product.unitsPerBox} u/caja` : null,
  ].filter(Boolean);

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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top gold accent bar */}
      <div
        style={{
          height: 6,
          flexShrink: 0,
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
          flexShrink: 0,
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
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, marginTop: 1 }}>
            {BRAND.tagline}
          </p>
        </div>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, fontFamily: "monospace" }}>
          {product?.sku}
        </p>
      </div>

      {/* Framed photo */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "18px 22px 0" }}>
        <FramedImage src={img} width={376} height={190} discount={discount} />
      </div>

      {/* Middle: absorbs the remaining space so the footer always sits flush at the bottom */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
          padding: "16px 22px",
        }}
      >
        <div>
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
              margin: "4px 0 0",
            }}
          >
            {product?.name}
          </h2>
          {showDescription && (
            <p
              style={{
                color: "#64748b",
                fontSize: 10,
                lineHeight: 1.5,
                margin: "6px 0 0",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.description}
            </p>
          )}
        </div>

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
                <p style={{ color: "#64748b", fontSize: 11, textDecoration: "line-through" }}>
                  S/ {price.toFixed(2)}
                </p>
                <p style={{ color: "#fb7185", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>
                  S/ {salePrice.toFixed(2)}
                </p>
              </div>
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
            </>
          ) : (
            <p style={{ color: BRAND.color, fontWeight: 900, fontSize: 28, lineHeight: 1 }}>
              S/ {price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Specs (only when there's something real to show) */}
        {specs.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {specs.map((s, i) => (
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
        )}
      </div>

      {/* QR Footer — always pinned to the bottom edge */}
      <div
        style={{
          flexShrink: 0,
          borderTop: `3px solid ${BRAND.color}`,
          padding: "10px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc",
        }}
      >
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#475569" }}>{BRAND.web}</p>
          <p style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>{BRAND.phone}</p>
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
              <img src={qrUrl} alt="QR" style={{ width: 64, height: 64, display: "block" }} />
            </div>
            <p style={{ fontSize: 7, color: "#94a3b8", marginTop: 2 }}>Escanea y compra</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Horizontal label (banner style) — foto enmarcada a la izquierda ── */
export const HorizontalLabel = ({ product, qrUrl }) => {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);
  const img = getImage(product);
  const showDescription = hasOwnDescription(product);

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
        display: "flex",
      }}
    >
      {/* Left: framed photo */}
      <div style={{ position: "relative", padding: 16, flexShrink: 0 }}>
        <FramedImage src={img} width={190} height={328} discount={discount} />
        <div style={{ position: "absolute", top: 28, left: 28 }}>
          <div style={{ background: `${BRAND.color}ee`, borderRadius: 6, padding: "3px 10px" }}>
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
      </div>

      {/* Right: text content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "18px 22px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
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
                fontSize: 21,
                lineHeight: 1.2,
                margin: "3px 0 0",
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

        {/* Middle: absorbs the remaining space, keeping the footer flush at the bottom */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
          {showDescription && (
            <p
              style={{
                color: "#64748b",
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
                  <p style={{ color: "#64748b", fontSize: 10, textDecoration: "line-through" }}>
                    S/ {price.toFixed(2)}
                  </p>
                  <p
                    style={{
                      color: "#fb7185",
                      fontWeight: 900,
                      fontSize: 26,
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
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${BRAND.color}, #e8c97a)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 11,
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
                  fontSize: 28,
                  lineHeight: 1,
                  textShadow: `0 0 20px ${BRAND.color}33`,
                }}
              >
                S/ {price.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Footer — always pinned to the bottom edge */}
        <div
          style={{
            flexShrink: 0,
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
              <div style={{ background: "white", padding: 3, borderRadius: 7, boxShadow: `0 0 12px ${BRAND.color}33` }}>
                <img src={qrUrl} alt="QR" style={{ width: 50, height: 50, display: "block" }} />
              </div>
              <p style={{ color: "#475569", fontSize: 8, maxWidth: 50, textAlign: "right", lineHeight: 1.4 }}>
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
export const RENDERERS = {
  small: SmallLabel,
  medium: MediumLabel,
  premium: PremiumLabel,
  a4: A4Label,
  horizontal: HorizontalLabel,
};
