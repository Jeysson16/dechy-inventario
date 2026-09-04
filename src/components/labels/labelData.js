/**
 * labelData — shared label constants, helpers, and PDF drawing logic
 * (kept separate from labelTemplates.jsx so that file can stay
 * component-only for Vite Fast Refresh).
 */

/* ── Format catalogue ── */
export const FORMATS = [
  { id: "medium", label: "Mediana", desc: "Exhibición", w: 320, h: 480 },
  { id: "small", label: "Pequeña", desc: "Estantería", w: 300, h: 200 },
  { id: "premium", label: "Premium", desc: "Showroom", w: 400, h: 680 },
  { id: "a4", label: "A4 Vertical", desc: "Impresión", w: 420, h: 594 },
  { id: "horizontal", label: "Horizontal", desc: "Banner", w: 560, h: 360 },
];

/* ── Brand config ── */
export const BRAND = {
  name: "DECHY",
  tagline: "Acabados & Construcción",
  web: "www.dechy.pe",
  phone: "+51 946 303 481",
  ig: "@dechystore",
  color: "#CFAE70",
  dark: "#0F172A",
};

/* ── Helpers ── */
export function getPrice(product) {
  return Number(product?.unitPrice || product?.price || 0);
}
export function getSalePrice(product) {
  return product?.isOnSale && product?.salePrice > 0
    ? Number(product.salePrice)
    : null;
}
export function getDiscount(product) {
  return product?.discountPercent || 0;
}
export function getImage(product) {
  return (
    product?.mainImageUrl ||
    product?.imageUrl ||
    product?.imageUrls?.[0]?.url ||
    null
  );
}
export function getWholesalePrice(product) {
  return Number(product?.wholesalePrice || 0);
}
export function getWholesaleInfo(product) {
  const price = getWholesalePrice(product);
  if (!price) return null;
  return {
    price,
    threshold: product?.wholesaleThreshold || null,
    unit: product?.wholesaleThresholdUnit || "und",
  };
}

/* ══════════════════════════════════════════
   PDF EXPORT
   ══════════════════════════════════════════ */

export async function urlToBase64(url) {
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

/**
 * Draws one label onto the current page of an already-sized jsPDF doc.
 * Dispatches to a layout that actually fits the page's proportions:
 * short/wide pages (small shelf tag, horizontal banner) get a side-by-side
 * layout, tall pages (medium, premium, A4) keep the stacked layout — using
 * one fixed vertical composition for every size used to overflow off the
 * bottom of the short formats and cut content off.
 */
export function drawLabelToPDF(doc, product, imgData, qrData, pw, ph) {
  if (pw > ph) {
    drawWideLabelToPDF(doc, product, imgData, qrData, pw, ph);
  } else {
    drawTallLabelToPDF(doc, product, imgData, qrData, pw, ph);
  }
}

/** Side-by-side layout for short/wide formats (small, horizontal). */
function drawWideLabelToPDF(doc, product, imgData, qrData, pw, ph) {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);

  /* Background */
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, ph, "F");

  /* Gold left accent bar */
  doc.setFillColor(207, 174, 112);
  doc.rect(0, 0, 3, ph, "F");

  const pad = 12;
  const imgW = pw * 0.32;
  const textX = pad + 4;
  const textW = pw - imgW - pad * 2 - textX;

  let y = pad + 6;

  /* Brand */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(207, 174, 112);
  doc.text(BRAND.name.toUpperCase(), textX, y);
  y += 12;

  /* Product name (max 2 lines) */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(248, 250, 252);
  const nameLines = doc.splitTextToSize(product?.name || "", textW).slice(0, 2);
  doc.text(nameLines, textX, y);
  y += nameLines.length * 12 + 4;

  /* Category */
  if (product?.category) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(doc.splitTextToSize(product.category, textW)[0] || "", textX, y);
  }

  /* Price, pinned near the bottom so it never collides with the name */
  const priceY = ph - pad - 20;
  if (salePrice) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`S/ ${price.toFixed(2)}`, textX, priceY - 13);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(251, 113, 133);
    doc.text(`S/ ${salePrice.toFixed(2)}`, textX, priceY);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(207, 174, 112);
    doc.text(`S/ ${price.toFixed(2)}`, textX, priceY);
  }

  /* SKU */
  doc.setFont("courier", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`SKU: ${product?.sku || "—"}`, textX, ph - pad - 4);

  /* QR — bottom-right of the TEXT column, never touching the image panel */
  if (qrData) {
    const qrSize = Math.min(34, textW * 0.34);
    const qrX = textX + textW - qrSize;
    const qrY = ph - pad - qrSize - 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 3, 3, "F");
    doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);
  }

  /* Right: framed thumbnail — white backdrop (product photos are almost
     always shot on white) so it blends with no seam, bounded so a plain/
     flat-color photo still reads as an intentional photo tile instead of
     a stray color block. */
  const frameX = pw - pad - imgW;
  const frameY = pad;
  const frameH = ph - pad * 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(207, 174, 112);
  doc.setLineWidth(0.6);
  doc.roundedRect(frameX, frameY, imgW, frameH, 5, 5, "FD");
  if (imgData) {
    try {
      doc.addImage(imgData, "JPEG", frameX + 2, frameY + 2, imgW - 4, frameH - 4, undefined, "FAST");
    } catch {
      // skip if format issue
    }
  }
  if (discount > 0) {
    doc.setFillColor(244, 63, 94);
    doc.roundedRect(frameX + imgW - 28, frameY + 4, 24, 12, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`-${discount}%`, frameX + imgW - 25.5, frameY + 12.5);
  }
}

/** Stacked layout for tall formats (medium, premium, A4). */
function drawTallLabelToPDF(doc, product, imgData, qrData, pw, ph) {
  const price = getPrice(product);
  const salePrice = getSalePrice(product);
  const discount = getDiscount(product);

  /* Background */
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, ph, "F");

  /* Framed photo — white backdrop (product photos are almost always shot on
     white) so it blends with no seam, bounded so a plain/flat-color photo
     still reads as an intentional photo tile instead of a stray full-bleed
     color block or a jarring gradient bleeding through a light photo. */
  const pad = 14;
  const imgH = ph * 0.34;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(207, 174, 112);
  doc.setLineWidth(0.6);
  doc.roundedRect(pad, pad, pw - pad * 2, imgH, 8, 8, "FD");
  if (imgData) {
    try {
      doc.addImage(imgData, "JPEG", pad + 2, pad + 2, pw - pad * 2 - 4, imgH - 4, undefined, "FAST");
    } catch {
      // skip if format issue
    }
  }
  if (discount > 0) {
    doc.setFillColor(244, 63, 94);
    doc.roundedRect(pw - pad - 42, pad + 8, 34, 16, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`-${discount}%`, pw - pad - 38, pad + 19);
  }

  let y = pad + imgH + 18;

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

  /* QR code — normally pinned near the bottom, but pushed down below
     whatever content was drawn above it so long names/specs never make it
     overlap (this used to be a fixed offset from the page bottom, which
     collided with the spec badges on the shorter formats). */
  const qrSize = 56;
  const qrX = pw - 14 - qrSize;
  const qrY = Math.max(ph - 14 - qrSize - 12, y + 6);
  if (qrData) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 4, 4, "F");
    doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Escanea y compra", qrX, qrY + qrSize + 9);
  }

  /* Footer line — likewise pinned below the QR instead of a fixed offset */
  const footerLineY = Math.max(ph - 22, qrY + qrSize + 19);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.5);
  doc.line(14, footerLineY, pw - 14, footerLineY);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${BRAND.web}  ·  ${BRAND.phone}  ·  ${BRAND.ig}`, 14, footerLineY + 12);
}

/** Point-size (jsPDF pt units) for a given format id. */
export function getFormatPointSize(format) {
  const fmt = FORMATS.find((f) => f.id === format) || FORMATS[0];
  const scale = 0.75; // px → pt at 96dpi
  return { pw: fmt.w * scale, ph: fmt.h * scale };
}

/** Single-label PDF download. */
export async function exportLabelPDF(product, format, qrUrl) {
  const { default: jsPDF } = await import("jspdf");
  const { pw, ph } = getFormatPointSize(format);

  const doc = new jsPDF({
    orientation: pw > ph ? "l" : "p",
    unit: "pt",
    format: [pw, ph],
  });

  const imgSrc = getImage(product);
  const [imgData, qrData] = await Promise.all([
    imgSrc ? urlToBase64(imgSrc) : Promise.resolve(null),
    qrUrl ? urlToBase64(qrUrl) : Promise.resolve(null),
  ]);

  drawLabelToPDF(doc, product, imgData, qrData, pw, ph);
  doc.save(`etiqueta-${product?.sku || product?.id || "producto"}.pdf`);
}

/**
 * Multi-product PDF: one page per product, all sized to the same format.
 * `qrUrlByProductId` must already contain a generated QR data-URL per product id.
 */
export async function exportBatchLabelsPDF(products, format, qrUrlByProductId, onProgress) {
  const { default: jsPDF } = await import("jspdf");
  const { pw, ph } = getFormatPointSize(format);

  const doc = new jsPDF({
    orientation: pw > ph ? "l" : "p",
    unit: "pt",
    format: [pw, ph],
  });

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (i > 0) doc.addPage([pw, ph], pw > ph ? "l" : "p");
    onProgress?.(i + 1, products.length);

    const imgSrc = getImage(product);
    const qrUrl = qrUrlByProductId[product.id];
    const [imgData, qrData] = await Promise.all([
      imgSrc ? urlToBase64(imgSrc) : Promise.resolve(null),
      qrUrl ? urlToBase64(qrUrl) : Promise.resolve(null),
    ]);

    drawLabelToPDF(doc, product, imgData, qrData, pw, ph);
  }

  doc.save(`etiquetas-lote-${Date.now()}.pdf`);
}
