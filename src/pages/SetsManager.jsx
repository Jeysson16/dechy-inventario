import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db, storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

/* ─────────────────── helpers ─────────────────── */
const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const SET_CATEGORIES = [
  "Set de Cocina",
  "Set de Baño",
  "Set de Dormitorio",
  "Set de Sala",
  "Set de Oficina",
  "Set de Exterior",
  "Set Especial",
  "Promoción",
];

const autoSku = (name) =>
  "SET-" +
  name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.slice(0, 3))
    .slice(0, 3)
    .join("-");

/* Calculates how many full sets can be assembled */
const computeSetStock = (components, productMap) => {
  if (!components.length) return 0;
  return Math.min(
    ...components.map((c) => {
      const p = productMap[c.productId];
      if (!p) return 0;
      const upb = Number(p.unitsPerBox) || 1;
      const totalUnits =
        Number(p.currentStock || p.stock || 0) * upb +
        Number(p.remainderUnits || 0);
      return Math.floor(totalUnits / (Number(c.cantidad) || 1));
    }),
  );
};

/* Upload a single image or video file and return its download URL */
const uploadMedia = (file, onProgress) =>
  new Promise((resolve, reject) => {
    const storageRef = ref(storage, `sets/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) =>
        onProgress &&
        onProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref)),
    );
  });

const VIDEO_EXTS_SET = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogg"];
const isVideoUrlSet = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTS_SET.some((ext) => lower.includes(ext));
};

/* ─────────────────── SetPrintModal ─────────────────── */
const fetchImgBase64 = (url) =>
  fetch(url)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => null);

const SetPrintModal = ({ set, components, productMap, onClose }) => {
  const setPrice = Number(set?.price || set?.unitPrice || 0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [jpegLoading, setJpegLoading] = useState(false);

  const rows = (components || []).map((c) => {
    const p = productMap[c.productId];
    const unitPrice = Number(p?.unitPrice || p?.price || 0);
    const subtotal = unitPrice * c.cantidad;
    return { ...c, unitPrice, subtotal };
  });

  const individualTotal = rows.reduce((a, r) => a + r.subtotal, 0);
  const savedAmount = Math.max(0, individualTotal - setPrice);
  const discountPct =
    individualTotal > 0 ? Math.round((savedAmount / individualTotal) * 100) : 0;

  /* ── Build shared HTML string (no date, fully inline styles) ── */
  const buildHtml = () => {
    const logoSrc = `${window.location.origin}/img/brand/logo-dechy.png`;
    const fallbackLogo = `${window.location.origin}/img/brand/logopngdechy.png`;

    const rowsHtml = rows
      .map(
        (r, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        <td style="padding:10px 12px;color:#1e293b;font-weight:500;font-size:13px">
          ${r.productName}
          ${r.productSku ? `<br><span style="font-size:10px;font-family:monospace;color:#94a3b8">${r.productSku}</span>` : ""}
        </td>
        <td style="padding:10px 12px;text-align:center;font-weight:700;color:#334155;font-size:13px">${r.cantidad}</td>
        <td style="padding:10px 12px;text-align:right;color:#475569;font-size:13px">S/ ${r.unitPrice.toFixed(2)}</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#1e293b;font-size:13px">S/ ${r.subtotal.toFixed(2)}</td>
      </tr>`,
      )
      .join("");

    const savingsHtml =
      savedAmount > 0
        ? `<div style="background:#fff7ed;padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <p style="margin:0;font-size:14px;font-weight:900;color:#000">&#10024; ¡Ahorras!</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b">En comparación con comprar cada producto por separado</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0;font-size:20px;font-weight:900;color:#ffa500">S/ ${savedAmount.toFixed(2)}</p>
          <p style="margin:0;font-size:16px;font-weight:900;color:#FF0000">${discountPct}% descuento</p>
        </div>
      </div>`
        : "";

    const categoryHtml = set?.category
      ? `<p style="margin:2px 0 0;font-size:11px;font-weight:700;color:#475569">${set.category}</p>`
      : "";
    const descHtml = set?.description
      ? `<p style="margin:8px auto 0;font-size:11px;color:#64748b;max-width:380px;text-align:center">${set.description}</p>`
      : "";

    const extrasHtml =
      set?.extras?.length > 0
        ? `<div style="margin-top:16px;border-radius:12px;overflow:hidden;border:2px solid #f59e0b">
          <div style="background:#f59e0b;padding:10px 18px">
            <p style="margin:0;font-size:13px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.06em">&#10024; &#161;Dale un PLUS a tu compra!</p>
            <p style="margin:3px 0 0;font-size:10px;color:#fef9c3">Productos complementarios que puedes agregar a tu set</p>
          </div>
          <div style="padding:12px 16px;background:#fffbeb">
            <div style="display:flex;flex-wrap:wrap;gap:10px">
              ${(set.extras || [])
                .map(
                  (ex) => `
                <div style="display:flex;align-items:center;gap:10px;background:#fff;border-radius:10px;padding:8px 10px;border:1px solid #fde68a;flex:1;min-width:180px">
                  ${ex.imageUrl ? `<img src="${ex.imageUrl}" alt="${ex.productName}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid #fde68a" />` : `<div style="width:48px;height:48px;background:#fef3c7;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px">&#128230;</div>`}
                  <div style="min-width:0;flex:1">
                    <p style="margin:0;font-size:12px;font-weight:700;color:#1e293b">${ex.productName}</p>
                    <p style="margin:2px 0 0;font-size:10px;font-family:monospace;color:#94a3b8">${ex.productSku}</p>
                    <p style="margin:4px 0 0;font-size:13px;font-weight:900;color:#d97706">S/ ${Number(ex.price).toFixed(2)}</p>
                  </div>
                </div>`,
                )
                .join("")}
            </div>
          </div>
        </div>`
        : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${set?.name || "Set"} - Dechy Importaciones</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2cm 2.5cm; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    @media print { @page { margin: 1.5cm; size: A4 portrait; } body { padding: 0; } }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #1e293b;margin-bottom:20px">
    <img src="${logoSrc}" alt="Dechy" style="height:56px;object-fit:contain" onerror="this.src='${fallbackLogo}'"/>
    <div style="text-align:right">
      <p style="font-size:11px;color:#64748b">Dechy S.A.C.</p>
      ${categoryHtml}
    </div>
  </div>
  <div style="text-align:center;margin-bottom:20px">
    <span style="background:#ffa500;color:#fff;font-size:11px;font-weight:900;padding:4px 16px;border-radius:999px;letter-spacing:0.1em;text-transform:uppercase">&#9733; Oferta Especial &#9733;</span>
    <h2 style="margin:10px 0 4px;font-size:24px;font-weight:900;color:#0f172a">${set?.name}</h2>
    <p style="font-size:11px;font-family:monospace;color:#94a3b8">SKU: ${set?.sku}</p>
    ${descHtml}
  </div>
  <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:8px">Contenido del Set</p>
  <table style="margin-bottom:20px">
    <thead>
      <tr style="background:#ffa500;color:#fff">
        <th style="text-align:left;padding:8px 12px;font-size:12px;font-weight:900">Producto</th>
        <th style="text-align:center;padding:8px 12px;font-size:12px;font-weight:900;width:60px">Cant.</th>
        <th style="text-align:right;padding:8px 12px;font-size:12px;font-weight:900;width:110px">P. Unit.</th>
        <th style="text-align:right;padding:8px 12px;font-size:12px;font-weight:900;width:110px">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #e2e8f0">
        <td colspan="3" style="padding:8px 12px;text-align:right;font-size:12px;font-weight:600;color:#64748b">Precio individual total:</td>
        <td style="padding:8px 12px;text-align:right;font-size:14px;font-weight:700;color:#334155;text-decoration:line-through">S/ ${individualTotal.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <div style="border:2px solid #ffa500;border-radius:16px;overflow:hidden;margin-bottom:20px">
    <div style="background:#ffa500;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between">
      <p style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em">&#128176; Precio del Set</p>
      <p style="font-size:24px;font-weight:900">S/ ${setPrice.toFixed(2)}</p>
    </div>
    ${savingsHtml}
  </div>
    ${extrasHtml}
  <div style="text-align:center;border-top:1px solid #e2e8f0;padding-top:14px">
    <p style="font-size:11px;color:#64748b;font-weight:500">Válido en cualquiera de nuestras sucursales · Sujeto a disponibilidad de stock</p>
    <p style="font-size:10px;color:#94a3b8;margin-top:4px">${set?.sku || ""}</p>
  </div>
</body>
</html>`;
  };

  /* ── Print in new window (Blob URL → no about:blank) ── */
  const handlePrint = () => {
    const html = buildHtml();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=720,height=900");
    if (!win) {
      URL.revokeObjectURL(url);
      alert(
        "El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.",
      );
      return;
    }
    win.focus();
    setTimeout(() => {
      win.print();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 600);
  };

  /* ── Download PDF via jsPDF (no browser dialog) ── */
  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({
        format: "a4",
        orientation: "portrait",
        unit: "mm",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Logo
      const logoData = await fetchImgBase64(
        `${window.location.origin}/img/brand/logo-dechy.png`,
      ).catch(() =>
        fetchImgBase64(`${window.location.origin}/img/brand/logopngdechy.png`),
      );
      if (logoData) doc.addImage(logoData, "PNG", margin, y, 38, 15);

      // Company name (right)
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Dechy S.A.C.", pageW - margin, y + 7, { align: "right" });
      if (set?.category) {
        doc.setFont(undefined, "bold");
        doc.setTextColor(71, 85, 105);
        doc.text(set.category, pageW - margin, y + 12, { align: "right" });
      }
      y += 20;

      // Divider
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 9;

      // "Oferta Especial" pill
      doc.setFillColor(255, 165, 0);
      const pillTxt = "  OFERTA ESPECIAL  ";
      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      const pillW = doc.getTextWidth(pillTxt) + 4;
      doc.roundedRect((pageW - pillW) / 2, y, pillW, 7, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(pillTxt, pageW / 2, y + 5, { align: "center" });
      y += 12;

      // Set name
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.setTextColor(15, 23, 42);
      const nameLines = doc.splitTextToSize(set?.name || "", contentW);
      doc.text(nameLines, pageW / 2, y, { align: "center" });
      y += nameLines.length * 7 + 2;

      // SKU
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`SKU: ${set?.sku || ""}`, pageW / 2, y, { align: "center" });
      y += 5;

      // Description
      if (set?.description) {
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const dl = doc.splitTextToSize(set.description, contentW * 0.7);
        doc.text(dl, pageW / 2, y, { align: "center" });
        y += dl.length * 4 + 3;
      }
      y += 4;

      // Section label
      doc.setFontSize(8);
      doc.setFont(undefined, "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("CONTENIDO DEL SET", margin, y);
      y += 4;

      // Products table
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Producto", "Cant.", "P. Unit.", "Subtotal"]],
        body: rows.map((r) => [
          r.productName + (r.productSku ? `\n${r.productSku}` : ""),
          String(r.cantidad),
          `S/ ${r.unitPrice.toFixed(2)}`,
          `S/ ${r.subtotal.toFixed(2)}`,
        ]),
        foot: [
          ["", "", "Precio individual:", `S/ ${individualTotal.toFixed(2)}`],
        ],
        headStyles: {
          fillColor: [255, 165, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: { fontSize: 10, textColor: [30, 41, 59] },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [100, 116, 139],
          fontStyle: "bold",
          fontSize: 10,
          decoration: "linethrough",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "center", cellWidth: 18 },
          2: { halign: "right", cellWidth: 32 },
          3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
        },
      });
      y = doc.lastAutoTable.finalY + 7;

      // Price box
      doc.setFillColor(255, 165, 0);
      doc.roundedRect(margin, y, contentW, 13, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.setFontSize(11);
      doc.text("PRECIO DEL SET", margin + 5, y + 9);
      doc.setFontSize(14);
      doc.text(`S/ ${setPrice.toFixed(2)}`, pageW - margin - 5, y + 9, {
        align: "right",
      });
      y += 15;

      // Savings box
      if (savedAmount > 0) {
        doc.setFillColor(255, 247, 237);
        doc.roundedRect(margin, y, contentW, 15, 3, 3, "F");
        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text("Ahorras:", margin + 5, y + 7);
        doc.setFont(undefined, "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(
          "En comparación con comprar cada producto por separado",
          margin + 5,
          y + 12,
        );
        doc.setFont(undefined, "bold");
        doc.setFontSize(14);
        doc.setTextColor(255, 165, 0);
        doc.text(`S/ ${savedAmount.toFixed(2)}`, pageW - margin - 5, y + 8, {
          align: "right",
        });
        doc.setFontSize(11);
        doc.setTextColor(255, 0, 0);
        doc.text(`${discountPct}% descuento`, pageW - margin - 5, y + 13, {
          align: "right",
        });
        y += 17;
      }
      y += 6;

      // Extras / Plus section
      const extrasData = set?.extras || [];
      if (extrasData.length > 0) {
        const extrasImgs = await Promise.all(
          extrasData.map((ex) =>
            ex.imageUrl
              ? fetchImgBase64(ex.imageUrl).catch(() => null)
              : Promise.resolve(null),
          ),
        );

        // Section header bar
        doc.setFillColor(245, 158, 11);
        doc.roundedRect(margin, y, contentW, 11, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "bold");
        doc.setFontSize(9);
        doc.text("\u00A1DALE UN PLUS A TU COMPRA!", margin + 4, y + 5);
        doc.setFont(undefined, "normal");
        doc.setFontSize(7);
        doc.text(
          "Productos complementarios que puedes agregar",
          margin + 4,
          y + 9,
        );
        y += 13;

        const imgSz = 12;
        const rowH = 14;
        extrasData.forEach((ex, i) => {
          if (y + rowH > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = margin;
          }
          doc.setFillColor(
            i % 2 === 0 ? 255 : 255,
            i % 2 === 0 ? 251 : 255,
            i % 2 === 0 ? 235 : 255,
          );
          doc.rect(margin, y, contentW, rowH, "F");
          doc.setDrawColor(253, 230, 138);
          doc.setLineWidth(0.2);
          doc.rect(margin, y, contentW, rowH);

          if (extrasImgs[i]) {
            try {
              doc.addImage(
                extrasImgs[i],
                "JPEG",
                margin + 1.5,
                y + 1,
                imgSz,
                imgSz,
              );
            } catch (_) {}
          } else {
            doc.setFillColor(254, 243, 199);
            doc.roundedRect(margin + 1.5, y + 1, imgSz, imgSz, 2, 2, "F");
          }

          const xText = margin + imgSz + 4;
          doc.setTextColor(30, 41, 59);
          doc.setFont(undefined, "bold");
          doc.setFontSize(9);
          const nameClip = doc.splitTextToSize(
            ex.productName,
            contentW - imgSz - 42,
          );
          doc.text(nameClip[0], xText, y + 6);
          doc.setFont(undefined, "normal");
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(ex.productSku || "", xText, y + 10);
          doc.setFont(undefined, "bold");
          doc.setFontSize(10);
          doc.setTextColor(217, 119, 6);
          doc.text(
            `S/ ${Number(ex.price).toFixed(2)}`,
            pageW - margin - 3,
            y + 8,
            { align: "right" },
          );
          y += rowH;
        });
        y += 5;
      }

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Válido en cualquiera de nuestras sucursales · Sujeto a disponibilidad de stock",
        pageW / 2,
        y,
        { align: "center" },
      );
      y += 4;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(set?.sku || "", pageW / 2, y, { align: "center" });

      doc.save(`${set?.name || "Set"} - Dechy.pdf`);
    } catch (err) {
      console.error(err);
      toast.error("Error al generar PDF: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  /* ── Download JPEG via html2canvas ── */
  const handleDownloadJPEG = async () => {
    setJpegLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("set-print-content");

      // Clone outside fixed/scrollable overlay to avoid position offset bugs
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `position:absolute;top:0;left:-${el.offsetWidth + 50}px;width:${el.offsetWidth}px;background:#fff;z-index:-1;`;
      const clone = el.cloneNode(true);
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      let canvas;
      try {
        canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
      } finally {
        document.body.removeChild(wrapper);
      }

      const link = document.createElement("a");
      link.download = `${set?.name || "Set"} - Dechy.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } catch (err) {
      console.error(err);
      toast.error("Error al generar imagen: " + err.message);
    } finally {
      setJpegLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      style={{ animation: "setCardIn 0.2s cubic-bezier(.22,1,.36,1) both" }}
    >
      {/* Wrapper: hidden on screen print trigger */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden no-print-wrapper my-auto">
        {/* Modal actions bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
          <p className="text-sm font-bold text-slate-700">Vista previa</p>
          <div className="flex items-center gap-2">
            {/* Print */}
            <button
              onClick={handlePrint}
              title="Imprimir"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">
                print
              </span>
              Imprimir
            </button>
            {/* Download PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              title="Descargar PDF"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {pdfLoading ? (
                <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[15px]">
                  picture_as_pdf
                </span>
              )}
              PDF
            </button>
            {/* Download JPEG */}
            <button
              onClick={handleDownloadJPEG}
              disabled={jpegLoading}
              title="Descargar JPEG"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {jpegLoading ? (
                <span className="size-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[15px]">
                  image
                </span>
              )}
              JPEG
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-slate-500">
                close
              </span>
            </button>
          </div>
        </div>

        {/* ── PRINT CONTENT ── */}
        <div id="set-print-content" className="p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-slate-800">
            <img
              src="/img/brand/logo-dechy.png"
              alt="Dechy Importaciones"
              className="h-14 object-contain"
              onError={(e) => {
                e.target.src = "/img/brand/logo-horizontal.jpg";
              }}
            />
            <div className="text-right">
              <p className="text-xs text-slate-500">Dechy S.A.C.</p>
              {set?.category && (
                <p className="text-xs font-bold text-slate-600 mt-0.5">
                  {set.category}
                </p>
              )}
            </div>
          </div>

          {/* Banner oferta */}
          <div className="text-center mb-5">
            <div
              className="inline-block text-white text-xs font-black px-4 py-1 rounded-full tracking-widest uppercase mb-2"
              style={{ background: "#ffa500" }}
            >
              ★ Oferta Especial ★
            </div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              {set?.name}
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              SKU: {set?.sku}
            </p>
            {set?.description && (
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {set.description}
              </p>
            )}
          </div>

          {/* Products table */}
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Contenido del Set
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: "#ffa500" }} className="text-white">
                  <th className="text-left px-3 py-2 text-xs font-black rounded-tl-lg">
                    Producto
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-black w-12">
                    Cant.
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-black w-24">
                    P. Unit.
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-black w-24 rounded-tr-lg">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.productId}
                    className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                  >
                    <td className="px-3 py-2.5 text-slate-800 font-medium">
                      {r.productName}
                      {r.productSku && (
                        <span className="block text-[10px] font-mono text-slate-400">
                          {r.productSku}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                      {r.cantidad}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      S/ {r.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                      S/ {r.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-right text-xs font-semibold text-slate-500"
                  >
                    Precio individual total:
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-slate-700 line-through">
                    S/ {individualTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Price highlight box */}
          <div
            className="rounded-2xl overflow-hidden mb-5"
            style={{ border: "2px solid #ffa500" }}
          >
            <div
              className="text-white px-5 py-3 flex items-center justify-between"
              style={{ background: "#ffa500" }}
            >
              <p className="text-sm font-black uppercase tracking-wide">
                💰 Precio del Set
              </p>
              <p className="text-2xl font-black">S/ {setPrice.toFixed(2)}</p>
            </div>
            {savedAmount > 0 && (
              <div className="bg-primary/10 px-5 py-3 flex items-center justify-between">
                <div>
                  <p
                    className="text-sm font-black text-primary"
                    style={{ color: " #000000" }}
                  >
                    ✨ ¡Ahorras!
                  </p>
                  <p className="text-xs text-slate-500">
                    En comparación con comprar cada producto por separado
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-primary">
                    S/ {savedAmount.toFixed(2)}
                  </p>
                  <p
                    className="text-base font-black"
                    style={{ color: " #FF0000" }}
                  >
                    {discountPct}% descuento
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Extras / Plus */}
          {set?.extras?.length > 0 && (
            <div
              className="rounded-xl overflow-hidden mb-5"
              style={{ border: "2px solid #f59e0b" }}
            >
              <div style={{ background: "#f59e0b" }} className="px-4 py-2.5">
                <p className="text-sm font-black text-white uppercase tracking-wide">
                  ✨ ¡Dale un PLUS a tu compra!
                </p>
                <p className="text-[11px] text-yellow-100 mt-0.5">
                  Productos complementarios que puedes agregar a tu set
                </p>
              </div>
              <div className="bg-amber-50 p-3 flex flex-col gap-2">
                {set.extras.map((ex) => (
                  <div
                    key={ex.productId}
                    className="flex items-center gap-3 bg-white rounded-xl p-2 border border-amber-200"
                  >
                    {ex.imageUrl ? (
                      <img
                        src={ex.imageUrl}
                        alt={ex.productName}
                        className="size-12 rounded-lg object-cover flex-shrink-0 border border-amber-200"
                      />
                    ) : (
                      <div className="size-12 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 text-xl">
                        📦
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {ex.productName}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400">
                        {ex.productSku}
                      </p>
                    </div>
                    <p className="text-sm font-black text-amber-600 flex-shrink-0">
                      S/ {Number(ex.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500 font-medium">
              Válido en cualquiera de nuestras sucursales · Sujeto a
              disponibilidad de stock
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{set?.sku}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────── Card ─────────────────── */
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}
  >
    {children}
  </div>
);

/* ─────────────────── Skeleton ─────────────────── */
const Sk = ({ className = "" }) => (
  <div
    className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700 ${className}`}
  />
);

/* ─────────────────── SetForm (panel) ─────────────────── */
const EMPTY_FORM = {
  name: "",
  sku: "",
  description: "",
  price: "",
  category: "",
};

/* Builds preview images/videos array from existing set data */
const imagesFromSet = (set) => {
  if (set?.imageUrls?.length) {
    return set.imageUrls.map((img) => {
      const isObj = typeof img === "object" && img !== null;
      const url = isObj ? img.url : img;
      const type = isObj ? img.type : "primaria";
      const mediaType =
        isObj && img.mediaType
          ? img.mediaType
          : isVideoUrlSet(url)
            ? "video"
            : "image";
      return {
        file: null,
        preview: url,
        type,
        mediaType,
        isMain: url === set.mainImageUrl || url === set.imageUrl,
      };
    });
  }
  if (set?.imageUrl) {
    return [
      {
        file: null,
        preview: set.imageUrl,
        type: "primaria",
        mediaType: isVideoUrlSet(set.imageUrl) ? "video" : "image",
        isMain: true,
      },
    ];
  }
  return [];
};

const SetForm = ({
  editing,
  allProducts,
  productMap,
  branchId,
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [components, setComponents] = useState([]);
  const [extras, setExtras] = useState([]);
  const [images, setImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [extrasSearch, setExtrasSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const searchRef = useRef(null);
  const extrasSearchRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || "",
        sku: editing.sku || "",
        description: editing.description || "",
        price: editing.price || editing.unitPrice || "",
        category: editing.category || "",
      });
      setComponents(editing._components || []);
      setExtras(editing.extras || []);
      setImages(imagesFromSet(editing));
    } else {
      setForm(EMPTY_FORM);
      setComponents([]);
      setExtras([]);
      setImages([]);
    }
    setSearch("");
    setExtrasSearch("");
    setUploadProgress(0);
  }, [editing]);

  const f = (k, v) => {
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === "name" && !editing) next.sku = autoSku(v);
      return next;
    });
  };

  /* ── Media handlers ── */
  const handleFileChange = (e) => {
    if (!e.target.files?.length) return;
    const existingImageCount = images.filter(
      (i) => i.mediaType !== "video",
    ).length;
    let imageCounter = existingImageCount;
    const newItems = Array.from(e.target.files).map((file) => {
      const isVideo = file.type.startsWith("video/");
      const isFirstImage = !isVideo && imageCounter === 0;
      if (!isVideo) imageCounter++;
      return {
        file,
        preview: URL.createObjectURL(file),
        isMain: isFirstImage,
        type: isFirstImage ? "primaria" : "complementarias",
        mediaType: isVideo ? "video" : "image",
      };
    });
    setImages((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const setMainImage = (idx) => {
    if (images[idx]?.mediaType === "video") {
      toast.error("No se puede establecer un video como imagen principal.");
      return;
    }
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isMain: i === idx,
        type:
          i === idx
            ? "primaria"
            : img.type === "primaria"
              ? "complementarias"
              : img.type,
      })),
    );
  };

  const removeImage = (idx) =>
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (prev[idx].isMain && next.length > 0) {
        const firstImg = next.find((img) => img.mediaType !== "video");
        if (firstImg) {
          firstImg.isMain = true;
          firstImg.type = "primaria";
        }
      }
      return next;
    });

  const setImageType = (idx, type) =>
    setImages((prev) =>
      prev.map((img, i) => (i === idx ? { ...img, type } : img)),
    );

  /* ── Drag & drop to reorder images ── */
  const handleImgDragStart = (idx) => {
    dragItem.current = idx;
    setDraggingIdx(idx);
  };
  const handleImgDragEnter = (idx) => {
    dragOverItem.current = idx;
    setDragOverIdx(idx);
  };
  const handleImgDragEnd = () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from !== null && to !== null && from !== to) {
      setImages((prev) => {
        const arr = [...prev];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        return arr;
      });
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDragOverIdx(null);
    setDraggingIdx(null);
  };

  /* filtered product list for search */
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const usedIds = new Set(components.map((c) => c.productId));
    return allProducts
      .filter(
        (p) =>
          p.tipo_producto !== "set" &&
          !usedIds.has(p.id) &&
          (p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [search, allProducts, components]);

  const addComponent = (product) => {
    setComponents((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || "",
        cantidad: 1,
        _product: product,
      },
    ]);
    setSearch("");
    searchRef.current?.focus();
  };

  /* ── Extras (productos complementarios sugeridos) ── */
  const extrasSearchResults = useMemo(() => {
    const q = extrasSearch.trim().toLowerCase();
    if (!q) return [];
    const usedIds = new Set(extras.map((e) => e.productId));
    return allProducts
      .filter(
        (p) =>
          p.tipo_producto !== "set" &&
          !usedIds.has(p.id) &&
          (p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [extrasSearch, allProducts, extras]);

  const addExtra = (product) => {
    setExtras((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || "",
        price: Number(product.unitPrice || product.price || 0),
        imageUrl: product.mainImageUrl || product.imageUrl || null,
      },
    ]);
    setExtrasSearch("");
    extrasSearchRef.current?.focus();
  };

  const removeExtra = (productId) =>
    setExtras((prev) => prev.filter((e) => e.productId !== productId));

  const removeComponent = (productId) =>
    setComponents((prev) => prev.filter((c) => c.productId !== productId));

  const setQty = (productId, val) =>
    setComponents((prev) =>
      prev.map((c) =>
        c.productId === productId
          ? { ...c, cantidad: Math.max(1, Number(val) || 1) }
          : c,
      ),
    );

  const computedStock = computeSetStock(components, productMap);

  /* ── validation ── */
  const validate = () => {
    if (!form.name.trim()) return "El nombre del set es obligatorio.";
    if (!form.sku.trim()) return "El SKU es obligatorio.";
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0)
      return "El precio debe ser un número mayor a 0.";
    if (components.length === 0) return "Agrega al menos un producto al set.";
    for (const c of components) {
      if (!c.cantidad || c.cantidad < 1)
        return `La cantidad de "${c.productName}" debe ser ≥ 1.`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      await onSave({ form, components, computedStock, images, extras });
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const totalPrice = components.reduce((acc, c) => {
    const p = productMap[c.productId];
    const unitPrice = p ? Number(p.unitPrice || p.price || 0) : 0;
    return acc + unitPrice * c.cantidad;
  }, 0);

  const savings =
    totalPrice > 0 && Number(form.price) > 0
      ? Math.round(((totalPrice - Number(form.price)) / totalPrice) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
            {editing ? "Editar Set" : "Nuevo Set"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {editing ? `SKU: ${editing.sku}` : "Completa los campos del set"}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-slate-500">
            close
          </span>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Basic info */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Información del Set
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre del Set *
              </label>
              <input
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: Set Baño Moderno"
                value={form.name}
                onChange={(e) => f("name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SKU *
                </label>
                <div className="flex gap-1.5">
                  <input
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="SET-BAÑ-MOD"
                    value={form.sku}
                    onChange={(e) => f("sku", e.target.value.toUpperCase())}
                  />
                  <button
                    type="button"
                    title="Generar SKU automáticamente"
                    onClick={() => f("sku", autoSku(form.name))}
                    className="flex-shrink-0 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-primary hover:border-primary hover:text-white text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      auto_fix_high
                    </span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Precio del Set (S/) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => f("price", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descripción
              </label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Descripción del set..."
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
              />
            </div>
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoría del Set
              </label>
              <input
                list="set-categories-list"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: Set de Baño, Set de Cocina..."
                value={form.category}
                onChange={(e) => f("category", e.target.value)}
              />
              <datalist id="set-categories-list">
                {SET_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Image upload */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Imágenes y Videos
          </p>

          {/* Drop zone / trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-5 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors group"
          >
            <span className="material-symbols-outlined text-[28px] text-slate-400 group-hover:text-primary transition-colors">
              perm_media
            </span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">
              Subir imágenes o videos
            </p>
            <p className="text-[11px] text-slate-400">
              JPG, PNG, MP4, MOV · primera imagen será la principal
            </p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/mov,video/avi,video/mkv,video/ogg"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Preview grid */}
          {images.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-slate-400 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">
                  drag_indicator
                </span>
                Arrastra para reordenar · primera imagen = principal
              </p>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleImgDragStart(idx)}
                    onDragEnter={() => handleImgDragEnter(idx)}
                    onDragEnd={handleImgDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                      dragOverIdx === idx
                        ? "border-primary ring-2 ring-primary/40 scale-[1.03]"
                        : img.isMain
                          ? "border-primary shadow-sm"
                          : "border-slate-200 dark:border-slate-700"
                    }`}
                    style={{
                      animation: `setCardIn 0.25s cubic-bezier(.22,1,.36,1) ${idx * 0.04}s both`,
                      opacity: draggingIdx === idx ? 0.45 : 1,
                    }}
                  >
                    {img.mediaType === "video" ? (
                      <video
                        src={img.preview}
                        className="w-full aspect-square object-cover pointer-events-none"
                        muted
                        loop
                        playsInline
                        autoPlay
                      />
                    ) : (
                      <img
                        src={img.preview}
                        alt=""
                        className="w-full aspect-square object-cover"
                      />
                    )}

                    {/* Main badge */}
                    {img.isMain && (
                      <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                        PRINCIPAL
                      </div>
                    )}
                    {img.mediaType === "video" && (
                      <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">
                          videocam
                        </span>
                        VIDEO
                      </div>
                    )}

                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-end justify-center pb-2 gap-1.5 opacity-0 hover:opacity-100">
                      {!img.isMain && img.mediaType !== "video" && (
                        <button
                          type="button"
                          onClick={() => setMainImage(idx)}
                          className="bg-white/90 text-slate-800 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-white transition-colors"
                          title="Hacer principal"
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            star
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="bg-red-500/90 text-white text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          delete
                        </span>
                      </button>
                    </div>

                    {/* Type selector */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                      <select
                        value={img.type}
                        onChange={(e) => setImageType(idx, e.target.value)}
                        className="w-full bg-transparent text-white text-[9px] font-semibold focus:outline-none cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="primaria" className="text-slate-900">
                          Primaria
                        </option>
                        <option
                          value="complementarias"
                          className="text-slate-900"
                        >
                          Complementaria
                        </option>
                        <option value="textura" className="text-slate-900">
                          Textura
                        </option>
                        <option value="uso" className="text-slate-900">
                          Uso
                        </option>
                        <option
                          value="imagen referencial"
                          className="text-slate-900"
                        >
                          Referencial
                        </option>
                        <option value="medidas" className="text-slate-900">
                          Medidas
                        </option>
                      </select>
                    </div>
                  </div>
                ))}
                {/* Add more button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors group"
                >
                  <span className="material-symbols-outlined text-[20px] text-slate-300 group-hover:text-primary transition-colors">
                    add
                  </span>
                  <span className="text-[9px] text-slate-400 group-hover:text-primary">
                    Más
                  </span>
                </button>{" "}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 text-center">
                Subiendo archivos… {Math.round(uploadProgress)}%
              </p>
            </div>
          )}
        </div>

        {/* Product search */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Agregar Productos
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">
              search
            </span>
            <input
              ref={searchRef}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Buscar producto por nombre o SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                  close
                </span>
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {searchResults.length > 0 && (
            <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden max-h-52 overflow-y-auto z-10 relative">
              {searchResults.map((p) => {
                const upb = Number(p.unitsPerBox) || 1;
                const totalU =
                  Number(p.currentStock || p.stock || 0) * upb +
                  Number(p.remainderUnits || 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => addComponent(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    {p.mainImageUrl || p.imageUrl ? (
                      <img
                        src={p.mainImageUrl || p.imageUrl}
                        alt={p.name}
                        className="size-9 rounded-lg object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">
                          inventory_2
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {p.sku} · {totalU} unid. disponibles
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-primary flex-shrink-0">
                      add_circle
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {search.trim() && searchResults.length === 0 && (
            <p className="text-xs text-slate-400 mt-2 text-center py-3">
              Sin resultados para "{search}"
            </p>
          )}
        </div>

        {/* Components table */}
        {components.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Componentes del Set ({components.length})
            </p>
            <div className="space-y-2">
              {components.map((c, idx) => {
                const p = productMap[c.productId] || c._product;
                const upb = Number(p?.unitsPerBox) || 1;
                const totalU =
                  Number(p?.currentStock || p?.stock || 0) * upb +
                  Number(p?.remainderUnits || 0);
                const maxSets = Math.floor(totalU / c.cantidad);
                const color = COLORS[idx % COLORS.length];
                return (
                  <div
                    key={c.productId}
                    className="flex items-center gap-3 rounded-xl p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {c.productName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {c.productSku}
                        </span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            totalU === 0
                              ? "text-red-500"
                              : totalU < c.cantidad * 5
                                ? "text-amber-500"
                                : "text-emerald-600"
                          }`}
                        >
                          {totalU} disp. → {maxSets} sets
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() =>
                          setQty(c.productId, Math.max(1, c.cantidad - 1))
                        }
                        className="size-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-slate-300">
                          remove
                        </span>
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={c.cantidad}
                        onChange={(e) => setQty(c.productId, e.target.value)}
                        className="w-12 text-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => setQty(c.productId, c.cantidad + 1)}
                        className="size-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-slate-300">
                          add
                        </span>
                      </button>
                      <button
                        onClick={() => removeComponent(c.productId)}
                        className="size-7 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors ml-1"
                      >
                        <span className="material-symbols-outlined text-[14px] text-red-500">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock preview */}
        {components.length > 0 && (
          <div
            className={`rounded-2xl p-4 border ${
              computedStock === 0
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : computedStock < 5
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Stock disponible del Set
                </p>
                <p
                  className={`text-3xl font-black mt-0.5 ${
                    computedStock === 0
                      ? "text-red-600 dark:text-red-400"
                      : computedStock < 5
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {computedStock} sets
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Limitado por el producto con menor stock
                </p>
              </div>
              {savings > 0 && (
                <div className="text-center px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-lg font-black text-primary">{savings}%</p>
                  <p className="text-[10px] text-slate-500">
                    ahorro vs. individual
                  </p>
                </div>
              )}
            </div>
            {totalPrice > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                Precio individual sumado:{" "}
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  S/ {totalPrice.toFixed(2)}
                </span>
                {Number(form.price) > 0 && (
                  <>
                    {" "}
                    → Set:{" "}
                    <span className="font-bold text-primary">
                      S/ {Number(form.price).toFixed(2)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Extras / Complementarios */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="size-5 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[13px] text-amber-600 dark:text-amber-400">
                auto_awesome
              </span>
            </span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Productos Extra / Complementarios
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            Productos que el cliente puede necesitar además del set (ej: grifos,
            tubos de desagüe). Se muestran como sugerencias.
          </p>

          {/* Extras search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">
              search
            </span>
            <input
              ref={extrasSearchRef}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Buscar producto extra por nombre o SKU…"
              value={extrasSearch}
              onChange={(e) => setExtrasSearch(e.target.value)}
            />
            {extrasSearch && (
              <button
                onClick={() => setExtrasSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                  close
                </span>
              </button>
            )}
          </div>

          {/* Extras dropdown */}
          {extrasSearchResults.length > 0 && (
            <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden max-h-52 overflow-y-auto z-10 relative">
              {extrasSearchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addExtra(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left"
                >
                  {p.mainImageUrl || p.imageUrl ? (
                    <img
                      src={p.mainImageUrl || p.imageUrl}
                      alt={p.name}
                      className="size-9 rounded-lg object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">
                        inventory_2
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {p.sku} · S/{" "}
                      {Number(p.unitPrice || p.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-amber-500 flex-shrink-0">
                    add_circle
                  </span>
                </button>
              ))}
            </div>
          )}
          {extrasSearch.trim() && extrasSearchResults.length === 0 && (
            <p className="text-xs text-slate-400 mt-2 text-center py-3">
              Sin resultados para "{extrasSearch}"
            </p>
          )}

          {/* Extras list */}
          {extras.length > 0 && (
            <div className="mt-3 space-y-2">
              {extras.map((ex) => (
                <div
                  key={ex.productId}
                  className="flex items-center gap-3 rounded-xl p-3 border border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/10"
                >
                  {ex.imageUrl ? (
                    <img
                      src={ex.imageUrl}
                      alt={ex.productName}
                      className="size-10 rounded-lg object-cover flex-shrink-0 border border-amber-200 dark:border-amber-700"
                    />
                  ) : (
                    <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-amber-500">
                        auto_awesome
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {ex.productName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {ex.productSku}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                      S/ {Number(ex.price).toFixed(2)}
                    </p>
                    <p className="text-[9px] text-slate-400">c/u</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExtra(ex.productId)}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                    title="Quitar extra"
                  >
                    <span className="material-symbols-outlined text-[15px] text-red-400">
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && (
            <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          {saving ? "Guardando…" : editing ? "Guardar Cambios" : "Crear Set"}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────── Main Page ─────────────────── */
const SetsManager = () => {
  const { currentBranch, userRole } = useAuth();
  const branchId = currentBranch?.id;

  const [sets, setSets] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [setComponents, setSetComponents] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [printSet, setPrintSet] = useState(null);

  /* ── Load sets ── */
  useEffect(() => {
    if (!branchId) return;
    const q = query(
      collection(db, "products"),
      where("branch", "==", branchId),
      where("tipo_producto", "==", "set"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setSets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [branchId]);

  /* ── Load all simple products for search ── */
  useEffect(() => {
    if (!branchId) return;
    const q = query(
      collection(db, "products"),
      where("branch", "==", branchId),
      orderBy("name"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [branchId]);

  /* ── Load components for each set ── */
  useEffect(() => {
    if (!sets.length) return;
    const unsubs = sets.map((s) => {
      const q = query(
        collection(db, "productSetItems"),
        where("setId", "==", s.id),
      );
      return onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSetComponents((prev) => ({ ...prev, [s.id]: items }));
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [sets]);

  /* ── Product map for quick lookup ── */
  const productMap = useMemo(
    () => Object.fromEntries(allProducts.map((p) => [p.id, p])),
    [allProducts],
  );

  /* ── Filtered sets ── */
  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sets.filter((s) => {
      const bySearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.sku?.toLowerCase().includes(q);
      const byCat = activeCategory === "Todos" || s.category === activeCategory;
      return bySearch && byCat;
    });
  }, [sets, search, activeCategory]);

  /* ── Unique categories ── */
  const allCategories = useMemo(() => {
    const cats = new Set(
      sets.map((s) => s.category || "Sin categoría").filter(Boolean),
    );
    return ["Todos", ...Array.from(cats).sort()];
  }, [sets]);

  /* ── Open form ── */
  const openCreate = () => {
    setEditingSet(null);
    setShowForm(true);
  };
  const openEdit = (set) => {
    setEditingSet({
      ...set,
      _components: (setComponents[set.id] || []).map((c) => ({
        ...c,
        _product: productMap[c.productId],
      })),
    });
    setShowForm(true);
  };

  /* ── Save (create/update) ── */
  const handleSave = async ({
    form,
    components,
    computedStock,
    images,
    extras = [],
  }) => {
    try {
      const batch = writeBatch(db);

      // 1. Upload new images/videos (file !== null), keep existing URLs as-is
      let uploadedUrls = [];
      if (images.length > 0) {
        let done = 0;
        uploadedUrls = await Promise.all(
          images.map(async (img) => {
            if (img.file) {
              const url = await uploadMedia(img.file, () => {});
              done++;
              return url;
            }
            done++;
            return img.preview; // already uploaded URL
          }),
        );
      }

      const mainIdx = images.findIndex((img) => img.isMain);
      const mainImageUrl = uploadedUrls[mainIdx !== -1 ? mainIdx : 0] || null;
      const richImageUrls = uploadedUrls.map((url, idx) => ({
        url,
        type: images[idx]?.type || "complementarias",
        mediaType: images[idx]?.mediaType || "image",
      }));

      const productPayload = {
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        description: form.description.trim(),
        unitPrice: Number(form.price),
        price: Number(form.price),
        tipo_producto: "set",
        branch: branchId,
        category: form.category.trim() || "Sin categoría",
        computedStock,
        componentsCount: components.length,
        componentsSummary: components.map((c) => c.productName),
        status:
          computedStock === 0
            ? "Agotado"
            : computedStock < 5
              ? "Stock Bajo"
              : "Disponible",
        extras: extras.map((e) => ({
          productId: e.productId,
          productName: e.productName,
          productSku: e.productSku || "",
          price: Number(e.price) || 0,
          imageUrl: e.imageUrl || null,
        })),
        updatedAt: serverTimestamp(),
        ...(mainImageUrl && {
          mainImageUrl,
          imageUrl: mainImageUrl,
          imageUrls: richImageUrls,
        }),
      };

      let setId;
      if (editingSet) {
        setId = editingSet.id;
        const ref = doc(db, "products", setId);
        batch.update(ref, productPayload);

        // delete old components
        const oldItems = await getDocs(
          query(collection(db, "productSetItems"), where("setId", "==", setId)),
        );
        oldItems.forEach((d) => batch.delete(d.ref));
      } else {
        productPayload.createdAt = serverTimestamp();
        productPayload.currentStock = 0;
        productPayload.remainderUnits = 0;
        productPayload.locations = {};
        const newRef = doc(collection(db, "products"));
        setId = newRef.id;
        batch.set(newRef, productPayload);
      }

      // Write new components
      components.forEach((c, idx) => {
        const ref = doc(collection(db, "productSetItems"));
        batch.set(ref, {
          setId,
          productId: c.productId,
          productName: c.productName,
          productSku: c.productSku || "",
          cantidad: Number(c.cantidad),
          order: idx,
          branchId,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
      toast.success(
        editingSet
          ? "Set actualizado correctamente."
          : "Set creado correctamente.",
      );
      setShowForm(false);
      setEditingSet(null);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar el set: " + err.message);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (set) => {
    setDeleting(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "products", set.id));
      const items = await getDocs(
        query(collection(db, "productSetItems"), where("setId", "==", set.id)),
      );
      items.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      toast.success("Set eliminado.");
      setConfirmDelete(null);
    } catch (err) {
      toast.error("Error al eliminar: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  /* ─── Admin guard ─── */
  if (userRole !== "admin") {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
              lock
            </span>
            <p className="text-slate-500 dark:text-slate-400 mt-3 font-semibold">
              Acceso restringido
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Esta sección es solo para administradores.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* ── Main list ── */}
        <div
          className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${showForm ? "hidden lg:flex" : "flex"}`}
        >
          {/* Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5 flex-shrink-0">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Sets / Bundles
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Productos compuestos de múltiples artículos
                </p>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative mt-4 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">
                search
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Buscar sets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category filter pills */}
            {allCategories.length > 1 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                      activeCategory === cat
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {cat}
                    {cat !== "Todos" && (
                      <span className="ml-1 opacity-60">
                        (
                        {
                          sets.filter(
                            (s) => (s.category || "Sin categoría") === cat,
                          ).length
                        }
                        )
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-40" />
                ))}
              </div>
            ) : filteredSets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
                  style
                </span>
                <p className="text-slate-500 dark:text-slate-400 font-semibold mt-3">
                  {search ? "Sin resultados" : "No hay sets creados"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {search
                    ? `No se encontró "${search}"`
                    : "Crea tu primer set de productos"}
                </p>
                {!search && (
                  <button
                    onClick={openCreate}
                    className="mt-4 px-5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Crear Set
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSets.map((set, si) => {
                  const comps = setComponents[set.id] || [];
                  const stock = computeSetStock(comps, productMap);
                  const color = COLORS[si % COLORS.length];
                  return (
                    <Card
                      key={set.id}
                      className="overflow-hidden hover:-translate-y-1 transition-transform cursor-pointer"
                      style={{
                        animation: `setCardIn 0.3s cubic-bezier(.22,1,.36,1) ${si * 0.05}s both`,
                      }}
                    >
                      {/* Color stripe */}
                      <div
                        className="h-1.5 w-full"
                        style={{ background: color }}
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {set.mainImageUrl || set.imageUrl ? (
                                <img
                                  src={set.mainImageUrl || set.imageUrl}
                                  alt={set.name}
                                  className="size-10 rounded-xl object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div
                                  className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: `${color}18` }}
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px]"
                                    style={{ color }}
                                  >
                                    style
                                  </span>
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate leading-tight">
                                  {set.name}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400">
                                  {set.sku}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintSet(set);
                              }}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                              title="Imprimir leyenda del set"
                            >
                              <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">
                                print
                              </span>
                            </button>
                            <button
                              onClick={() => openEdit(set)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px] text-slate-500">
                                edit
                              </span>
                            </button>
                            <button
                              onClick={() => setConfirmDelete(set)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px] text-red-400">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Price + stock */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1">
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">
                              S/{" "}
                              {Number(
                                set.price || set.unitPrice || 0,
                              ).toLocaleString()}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              precio del set
                            </p>
                          </div>
                          <div
                            className={`text-center px-3 py-1.5 rounded-xl ${
                              stock === 0
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                : stock < 5
                                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                  : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            <p className="text-xl font-black">{stock}</p>
                            <p className="text-[10px] font-semibold">disp.</p>
                          </div>
                        </div>

                        {/* Components */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Incluye ({comps.length}):
                          </p>
                          {comps.slice(0, 3).map((c, ci) => {
                            const p = productMap[c.productId];
                            const upb = Number(p?.unitsPerBox) || 1;
                            const totalU =
                              Number(p?.currentStock || p?.stock || 0) * upb +
                              Number(p?.remainderUnits || 0);
                            return (
                              <div
                                key={c.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <div
                                  className="size-1.5 rounded-full flex-shrink-0"
                                  style={{
                                    background: COLORS[ci % COLORS.length],
                                  }}
                                />
                                <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">
                                  {c.cantidad}× {c.productName}
                                </span>
                                <span
                                  className={`font-semibold flex-shrink-0 ${
                                    totalU < c.cantidad
                                      ? "text-red-500"
                                      : "text-slate-400"
                                  }`}
                                >
                                  ({totalU}u)
                                </span>
                              </div>
                            );
                          })}
                          {comps.length > 3 && (
                            <p className="text-[10px] text-slate-400 pl-3.5">
                              +{comps.length - 3} más…
                            </p>
                          )}
                        </div>

                        {/* Status badge */}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              stock === 0
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                : stock < 5
                                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                  : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {stock === 0
                              ? "Agotado"
                              : stock < 5
                                ? "Stock Bajo"
                                : "Disponible"}
                          </span>
                          <div className="flex items-center gap-1">
                            {set.category &&
                              set.category !== "Sin categoría" && (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                  {set.category}
                                </span>
                              )}
                            <button
                              onClick={() => openEdit(set)}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Editar →
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Form panel ── */}
        {showForm && (
          <div
            className={`${showForm ? "flex" : "hidden"} flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full lg:w-[440px] flex-shrink-0 overflow-hidden`}
            style={{
              animation: "panelSlideIn 0.3s cubic-bezier(.22,1,.36,1) both",
            }}
          >
            <SetForm
              editing={editingSet}
              allProducts={allProducts}
              productMap={productMap}
              branchId={branchId}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingSet(null);
              }}
            />
          </div>
        )}

        {/* ── Delete confirm modal ── */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 w-full max-w-sm mx-4"
              style={{
                animation: "setCardIn 0.2s cubic-bezier(.22,1,.36,1) both",
              }}
            >
              <div className="size-12 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[24px] text-red-600 dark:text-red-400">
                  delete_forever
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-1">
                ¿Eliminar este set?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                Se eliminará el set{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  "{confirmDelete.name}"
                </span>{" "}
                y todos sus componentes. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deleting && (
                    <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  {deleting ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Print Modal ── */}
      {printSet && (
        <SetPrintModal
          set={printSet}
          components={setComponents[printSet.id] || []}
          productMap={productMap}
          onClose={() => setPrintSet(null)}
        />
      )}

      <style>{`
        @keyframes setCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </AppLayout>
  );
};

export default SetsManager;
