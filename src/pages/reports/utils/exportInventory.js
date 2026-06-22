/**
 * exportInventory.js
 * Exports filtered inventory data to Excel (.xlsx) and PDF.
 * Design matches the "Reporte de Stock Bajo — JIEDA" template.
 */

const LOGO_PATH = "/img/brand/logo-jieda.png";
const BRAND = "JIEDA";

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Loads any image URL into a data URL via an <img> + canvas.
 * Works with CORS-enabled origins; returns null silently if blocked.
 */
async function imgToDataUrl(url, size = 80) {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = (result) => resolve(result);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        // Fill white background (avoid transparency issues in xlsx)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        // Cover-fit
        const ratio = Math.min(size / img.width, size / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        done(canvas.toDataURL("image/png"));
      } catch {
        done(null); // canvas tainted = CORS not configured
      }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

async function fetchLogoBuffer(url) {
  const dataUrl = await imgToDataUrl(url, 120);
  if (!dataUrl) return null;
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function fetchLogoDataUrl(url) {
  return imgToDataUrl(url, 120);
}

/* ── Excel export ─────────────────────────────────────────── */

/**
 * Exports the filtered inventory list to an Excel file.
 * @param {Array}  filtered   - Array of stockData items (post-filter)
 * @param {object} opts
 * @param {string} opts.branchName  - Company / branch name shown in title
 * @param {string} opts.catFilter   - Active category filter label
 * @param {string} opts.subFilter   - Active subcategory filter label
 */
export async function exportInventoryToExcel(
  filtered,
  { branchName = BRAND, catFilter = "Todas", subFilter = "Todas" } = {},
) {
  const ExcelJS = (await import("exceljs")).default;
  const { saveAs } = await import("file-saver");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema JIEDA";
  wb.created = new Date();

  const ws = wb.addWorksheet("Reporte Stock Bajo", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
    },
    properties: { tabColor: { argb: "FF0F172A" } },
  });

  /* Column widths */
  ws.columns = [
    { key: "img", width: 14 }, // A – Imagen
    { key: "sku", width: 15 }, // B – SKU / Código
    { key: "nom", width: 38 }, // C – Nombre del producto
    { key: "cat", width: 32 }, // D – Categoría / Subcategoría
    { key: "stk", width: 15 }, // E – Stock actual
  ];

  /* Color palette */
  const C = {
    DARK: "FF0F172A",
    HEADER: "FF1E293B",
    ACCENT_GREEN: "FF16A34A",
    WHITE: "FFFFFFFF",
    GRAY: "FF94A3B8",
    SLATE: "FF64748B",
    BG_ALT: "FFF8FAFC",
    BORDER: "FFE2E8F0",
    RED: "FFEF4444",
    AMBER: "FFF59E0B",
    GREEN: "FF16A34A",
    SLATE_800: "FF1E293B",
  };

  const darkFill = (argb = C.DARK) => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  });

  /* ── Row heights ── */
  ws.getRow(1).height = 46;
  ws.getRow(2).height = 26;
  ws.getRow(3).height = 12;
  ws.getRow(4).height = 30;

  /* Fill all header rows (1–3) with dark background */
  for (let r = 1; r <= 3; r++) {
    for (const col of ["A", "B", "C", "D", "E"]) {
      ws.getCell(`${col}${r}`).fill = darkFill();
    }
  }

  /* Merge areas */
  ws.mergeCells("A1:B3"); // logo zone
  ws.mergeCells("C1:E1"); // title
  ws.mergeCells("C2:E2"); // subtitle
  ws.mergeCells("C3:E3"); // thin spacer

  /* Logo cell base style */
  ws.getCell("A1").fill = darkFill();
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  /* Title */
  const titleCell = ws.getCell("C1");
  titleCell.value = `REPORTE DE STOCK BAJO — ${branchName.toUpperCase()}`;
  titleCell.font = {
    bold: true,
    size: 16,
    color: { argb: C.WHITE },
    name: "Calibri",
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  /* Subtitle */
  const subCell = ws.getCell("C2");
  subCell.value =
    "Productos con stock crítico o bajo · generado automáticamente desde el sistema de inventario";
  subCell.font = { size: 9, color: { argb: C.GRAY }, name: "Calibri" };
  subCell.alignment = { horizontal: "center", vertical: "middle" };

  /* ── Embed logo image ── */
  const logoBuf = await fetchLogoBuffer(LOGO_PATH);
  if (logoBuf) {
    const imageId = wb.addImage({ buffer: logoBuf, extension: "png" });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      br: { col: 2, row: 3 },
      editAs: "oneCell",
    });
  }

  /* ── Pre-load all product images in parallel ── */
  const productImgDataUrls = await Promise.all(
    filtered.map((p) => imgToDataUrl(p.imageUrl, 80)),
  );

  /* ── Column headers (row 4) ── */
  const HEADERS = [
    { col: "A", label: "Imagen" },
    { col: "B", label: "SKU / Código" },
    { col: "C", label: "Nombre del producto" },
    { col: "D", label: "Categoría / Subcategoría", accent: true },
    { col: "E", label: "Stock actual" },
  ];

  HEADERS.forEach(({ col, label, accent }) => {
    const cell = ws.getCell(`${col}4`);
    cell.value = label;
    cell.font = {
      bold: true,
      size: 11,
      color: { argb: C.WHITE },
      name: "Calibri",
    };
    cell.fill = darkFill(C.HEADER);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: {
        style: accent ? "medium" : "thin",
        color: { argb: accent ? C.ACCENT_GREEN : "FF334155" },
      },
    };
  });

  /* Auto-filter on header row */
  ws.autoFilter = { from: "A4", to: "E4" };

  /* ── Data rows ── */
  filtered.forEach((p, i) => {
    const rn = i + 5;
    ws.getRow(rn).height = 52;

    const bg = i % 2 === 0 ? C.WHITE : C.BG_ALT;
    const borderBot = { style: "hair", color: { argb: C.BORDER } };

    const applyCell = (col, value, font = {}, align = {}) => {
      const cell = ws.getCell(`${col}${rn}`);
      cell.value = value;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = { bottom: borderBot };
      cell.font = { size: 10, name: "Calibri", ...font };
      cell.alignment = { vertical: "middle", ...align };
    };

    /* A – Imagen del producto */
    applyCell("A", "", {}, { horizontal: "center" });
    const imgDataUrl = productImgDataUrls[i];
    if (imgDataUrl) {
      const base64 = imgDataUrl.split(",")[1];
      const prodImgId = wb.addImage({ base64, extension: "png" });
      ws.addImage(prodImgId, {
        tl: { col: 0, row: rn - 1 + 0.05 },
        br: { col: 1, row: rn - 0.05 },
        editAs: "oneCell",
      });
    }

    /* B – SKU */
    applyCell(
      "B",
      p.sku || "–",
      { color: { argb: C.SLATE } },
      { horizontal: "center" },
    );

    /* C – Nombre */
    applyCell(
      "C",
      p.nombre || "–",
      { bold: true, size: 11 },
      { horizontal: "left", indent: 1 },
    );

    /* D – Categoría / Subcategoría */
    const catLabel = p.subcategoria
      ? `${p.categoria} / ${p.subcategoria}`
      : p.categoria || "–";
    applyCell(
      "D",
      catLabel,
      { color: { argb: C.SLATE } },
      { horizontal: "left", indent: 1 },
    );

    /* E – Stock actual (color-coded) */
    const stockArgb =
      p.estado === "critico"
        ? C.RED
        : p.estado === "alerta"
          ? C.AMBER
          : C.GREEN;
    applyCell(
      "E",
      p.stockActual ?? 0,
      { bold: true, size: 16, color: { argb: stockArgb } },
      { horizontal: "center" },
    );
  });

  /* Freeze top 4 rows */
  ws.views = [{ state: "frozen", ySplit: 4 }];

  /* ── Save file ── */
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeCat =
    catFilter && catFilter !== "Todas"
      ? `-${catFilter.replace(/[^\w]/g, "")}`
      : "";
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `reporte-stock${safeCat}-${dateStr}.xlsx`);
}

/* ── PDF export ───────────────────────────────────────────── */

/**
 * Exports the filtered inventory list to a PDF file using jsPDF + autoTable.
 */
export async function exportInventoryToPDF(
  filtered,
  { branchName = BRAND, catFilter = "Todas", subFilter = "Todas" } = {},
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  /* ── Dark header band ── */
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 38, "F");

  /* ── Logo ── */
  const logoDataUrl = await fetchLogoDataUrl(LOGO_PATH);
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, "PNG", 10, 7, 34, 22);
  }

  /* ── Title ── */
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  pdf.setFont("helvetica", "bold");
  pdf.text(`REPORTE DE STOCK BAJO — ${branchName.toUpperCase()}`, W / 2, 15, {
    align: "center",
  });

  /* ── Subtitle ── */
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    "Productos con stock crítico o bajo · generado automáticamente desde el sistema de inventario",
    W / 2,
    23,
    { align: "center" },
  );

  /* ── Meta line ── */
  const now = new Date();
  const metaParts = [
    `Generado: ${now.toLocaleDateString("es-PE")} · ${now.toLocaleTimeString("es-PE")}`,
    `${filtered.length} producto${filtered.length !== 1 ? "s" : ""}`,
    catFilter !== "Todas" ? `Categoría: ${catFilter}` : null,
    subFilter !== "Todas" ? `Subcategoría: ${subFilter}` : null,
  ].filter(Boolean);

  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(metaParts.join(" · "), W / 2, 31, { align: "center" });

  /* ── Pre-load all product images in parallel ── */
  const productImgDataUrls = await Promise.all(
    filtered.map((p) => imgToDataUrl(p.imageUrl, 80)),
  );

  /* ── Table ── */
  autoTable(pdf, {
    startY: 42,
    head: [
      [
        "Imagen",
        "SKU / Código",
        "Nombre del producto",
        "Categoría / Subcategoría",
        "Stock actual",
        "Estado",
      ],
    ],
    body: filtered.map((p, i) => [
      i + 1,
      p.sku || "–",
      p.nombre || "–",
      p.subcategoria
        ? `${p.categoria} / ${p.subcategoria}`
        : p.categoria || "–",
      p.stockActual ?? 0,
      p.estado === "critico"
        ? "Crítico"
        : p.estado === "alerta"
          ? "Alerta"
          : "OK",
    ]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      valign: "middle",
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 9.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 }, // imagen
      1: { halign: "center", cellWidth: 28, textColor: [100, 116, 139] },
      2: { cellWidth: "auto", fontStyle: "bold" },
      3: { cellWidth: 60, textColor: [100, 116, 139] },
      4: { halign: "center", cellWidth: 24, fontStyle: "bold", fontSize: 12 },
      5: { halign: "center", cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    rowPageBreak: "avoid",
    didDrawCell(data) {
      // Draw product image in column 0 (body only)
      if (data.section === "body" && data.column.index === 0) {
        const imgDataUrl = productImgDataUrls[data.row.index];
        if (imgDataUrl) {
          const pad = 1.5;
          const size = Math.min(data.cell.width, data.cell.height) - pad * 2;
          const cx = data.cell.x + (data.cell.width - size) / 2;
          const cy = data.cell.y + (data.cell.height - size) / 2;
          try {
            pdf.addImage(imgDataUrl, "PNG", cx, cy, size, size);
          } catch {
            /* skip if image fails in PDF context */
          }
        }
      }
    },
    didParseCell(data) {
      if (data.section !== "body") return;
      /* Stock actual column — color-code by value */
      if (data.column.index === 4) {
        const stock = Number(data.cell.raw);
        if (stock === 0) data.cell.styles.textColor = [239, 68, 68];
        else if (stock < 20) data.cell.styles.textColor = [245, 158, 11];
        else data.cell.styles.textColor = [22, 163, 74];
      }
      /* Estado column */
      if (data.column.index === 5) {
        if (data.cell.raw === "Crítico")
          data.cell.styles.textColor = [239, 68, 68];
        else if (data.cell.raw === "Alerta")
          data.cell.styles.textColor = [245, 158, 11];
        else data.cell.styles.textColor = [22, 163, 74];
      }
    },
    margin: { left: 10, right: 10 },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
    didDrawPage(data) {
      const pageCount = pdf.getNumberOfPages();
      pdf.setFontSize(7.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `JIEDA · Sistema de Inventario · Pág. ${data.pageNumber} de ${pageCount}`,
        W / 2,
        H - 5,
        { align: "center" },
      );
    },
  });

  /* ── Save file ── */
  const safeCat =
    catFilter && catFilter !== "Todas"
      ? `-${catFilter.replace(/[^\w]/g, "")}`
      : "";
  const dateStr = new Date().toISOString().slice(0, 10);
  pdf.save(`reporte-stock${safeCat}-${dateStr}.pdf`);
}
