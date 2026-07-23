import { doc, getDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../config/firebase";
import { ICBPER_UNIT_AMOUNT } from "../utils/sunat";

// ─── Datos de la empresa ──────────────────────────────────────────────────────
const DEFAULT_COMPANY = {
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
  web: "www.jieda.pe",
  logoPath: "/img/brand/logo-jieda.png",
};

// ─── Número a letras (español) ────────────────────────────────────────────────
const ONES = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function toWords(n) {
  if (n < 0) return "menos " + toWords(-n);
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  if (n < 20) return ONES[n];
  if (n < 30) return n === 20 ? "veinte" : "veinti" + ONES[n - 20];
  if (n < 100)
    return TENS[Math.floor(n / 10)] + (n % 10 ? " y " + ONES[n % 10] : "");
  if (n < 1000)
    return (
      HUNDREDS[Math.floor(n / 100)] + (n % 100 ? " " + toWords(n % 100) : "")
    );
  if (n === 1000) return "mil";
  if (n < 2000) return "mil " + toWords(n % 1000);
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    return toWords(miles) + " mil" + (resto ? " " + toWords(resto) : "");
  }
  return n.toString();
}

function amountInWords(amount) {
  const fixed = parseFloat(amount || 0).toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  return (
    "SON: " +
    toWords(parseInt(intPart)).toUpperCase() +
    " CON " +
    decPart +
    "/100 SOLES"
  );
}

// ─── Cálculo de impuestos ─────────────────────────────────────────────────────
function calcTaxes(items, bagCount = 0) {
  let exonerated = 0;
  let taxable = 0;
  (items || []).forEach((item) => {
    const sub = Number(item.subtotal) || 0;
    if (item.isExonerated) exonerated += sub;
    else taxable += sub;
  });
  const igvBase = taxable > 0 ? taxable / 1.18 : 0;
  const igv = taxable - igvBase;
  const icbper = bagCount * ICBPER_UNIT_AMOUNT;
  return { exonerated, igvBase, igv, icbper };
}

// ─── Detección del tipo de cliente ────────────────────────────────────────────
function getCustomerMode(sale) {
  const dni = sale?.customerDNI || "";
  if (!dni && !sale?.customerName) return "eventual";
  if (dni.length === 11) return "empresa";
  return "natural";
}

// ─── QR hook ─────────────────────────────────────────────────────────────────
function useQRCode(data) {
  const [qrUrl, setQrUrl] = useState("");
  useEffect(() => {
    if (!data) return;
    QRCode.toDataURL(data, { width: 180, margin: 1, errorCorrectionLevel: "Q" })
      .then(setQrUrl)
      .catch(() => {});
  }, [data]);
  return data ? qrUrl : "";
}

// ─── Generar HTML para impresora térmica 80mm ─────────────────────────────────
function buildPrintHTML({
  company,
  sale,
  docType,
  docSeries,
  docNumber,
  taxes,
  qrDataUrl,
  bagCount,
}) {
  const fullDocNumber = `${docSeries}-${String(docNumber).padStart(8, "0")}`;
  const docLabel =
    docType === "factura"
      ? "FACTURA DE VENTA ELECTRONICA"
      : docType === "boleta"
        ? "BOLETA DE VENTA ELECTRONICA"
        : "NOTA DE VENTA INTERNA";

  const payDate = sale.paymentDate
    ? sale.paymentDate.toDate
      ? sale.paymentDate.toDate()
      : new Date(sale.paymentDate)
    : new Date();
  const dateStr = payDate.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = payDate.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const total = Number(sale.totalValue) || 0;
  const paid = Number(sale.amountPaid) || total;
  const change = Math.max(0, paid - total);
  const customerMode = getCustomerMode(sale);

  let customerRows = "";
  if (customerMode === "eventual") {
    customerRows = `<tr><td colspan="2"><b>Cliente:</b> CLIENTE EVENTUAL</td></tr>`;
  } else if (customerMode === "empresa") {
    customerRows = `
      <tr><td style="width:38%"><b>Razon Social:</b></td><td>${sale.customerName || ""}</td></tr>
      <tr><td><b>RUC:</b></td><td>${sale.customerDNI || ""}</td></tr>`;
  } else {
    customerRows = `
      <tr><td style="width:38%"><b>Cliente:</b></td><td>${sale.customerName || "CLIENTE GENERAL"}</td></tr>
      ${sale.customerDNI ? `<tr><td><b>DNI:</b></td><td>${sale.customerDNI}</td></tr>` : ""}`;
  }

  const itemsHTML = (sale.items || [])
    .map((item) => {
      const exo = item.isExonerated ? " [EXO]" : "";
      const modeStr =
        item.saleMode === "cajas"
          ? `${item.quantitySoldBoxes} cj`
          : item.saleMode === "docenas"
            ? `${Math.round((item.quantitySoldUnits || 0) / 12)} doc`
            : `${item.quantitySoldUnits} und`;
      const pricePer = (
        Number(item.activePrice) ||
        Number(item.unitPrice) ||
        0
      ).toFixed(2);
      const sub = Number(item.subtotal).toFixed(2);
      const code = item.sku || (item.productId || "").slice(0, 6) || "--";
      return `
      <tr><td colspan="4" style="padding-top:3px;font-weight:bold;">${item.productName}${exo}</td></tr>
      <tr>
        <td style="color:#555;font-size:7.5pt;">${code}</td>
        <td>${modeStr}</td>
        <td style="text-align:right;">S/${pricePer}</td>
        <td style="text-align:right;">S/${sub}</td>
      </tr>`;
    })
    .join("");

  const taxRows = [
    taxes.exonerated > 0
      ? `<tr><td>Op. Exonerada:</td><td style="text-align:right;">S/ ${taxes.exonerated.toFixed(2)}</td></tr>`
      : "",
    taxes.igvBase > 0
      ? `<tr><td>Op. Gravada:</td><td style="text-align:right;">S/ ${taxes.igvBase.toFixed(2)}</td></tr>`
      : "",
    `<tr><td>IGV (18%):</td><td style="text-align:right;">S/ ${taxes.igv.toFixed(2)}</td></tr>`,
    bagCount > 0
      ? `<tr><td>ICBPER (${bagCount}x S/${ICBPER_UNIT_AMOUNT.toFixed(2)}):</td><td style="text-align:right;">S/ ${taxes.icbper.toFixed(2)}</td></tr>`
      : "",
  ].join("");

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Comprobante ${fullDocNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: 80mm auto; margin: 3mm 2mm; }
  body { font-family:'Courier New',Courier,monospace; font-size:8.5pt; color:#000; width:76mm; }
  .c { text-align:center; } .r { text-align:right; } .b { font-weight:bold; }
  .sep { border-top:1px dashed #000; margin:3mm 0; }
  table { width:100%; border-collapse:collapse; }
  td { padding:0.4mm 0; vertical-align:top; }
  .logo { max-width:32mm; height:auto; display:block; margin:0 auto 3mm; }
  .qr-img { display:block; margin:2mm auto; width:28mm; height:28mm; }
</style>
</head><body>
<div class="c">
  <img class="logo" src="${window.location.origin}${company.logoPath}" alt="Logo" />
  <p class="b" style="font-size:10pt;">${company.razonSocial || company.name}</p>
  <p>RUC: ${company.ruc || "NO CONFIGURADO"}</p>
  <p style="font-size:8pt;">${company.direccion || company.address}</p>
  <p style="font-size:8pt;">Tel: ${company.phone} | ${company.web}</p>
</div>
<div class="sep"></div>
<div class="c b">
  <p>${docLabel}</p>
  <p style="font-size:10pt;">${fullDocNumber}</p>
</div>
<div class="sep"></div>
<table><tbody>
  ${customerRows}
  <tr><td style="width:38%"><b>Fecha:</b></td><td>${dateStr}</td></tr>
  <tr><td><b>Hora:</b></td><td>${timeStr}</td></tr>
  <tr><td><b>Vendedor:</b></td><td>${sale.sellerName || sale.userName || "---"}</td></tr>
</tbody></table>
<div class="sep"></div>
<table>
  <thead>
    <tr style="border-bottom:1px solid #000;">
      <th style="text-align:left;padding-bottom:2px;">Cod</th>
      <th style="text-align:left;">Cant</th>
      <th class="r">P.U.</th>
      <th class="r">Total</th>
    </tr>
  </thead>
  <tbody>${itemsHTML}</tbody>
</table>
<div class="sep"></div>
<table><tbody>${taxRows}</tbody></table>
<div style="border-top:1px solid #000;margin:2px 0;"></div>
<table><tbody>
  <tr><td class="b" style="font-size:11pt;">TOTAL:</td><td class="r b" style="font-size:11pt;">S/ ${total.toFixed(2)}</td></tr>
</tbody></table>
<div class="sep"></div>
<table><tbody>
  <tr><td>Forma de Pago:</td><td class="r b">${sale.paymentMethod || "EFECTIVO"}</td></tr>
  <tr><td>Monto Recibido:</td><td class="r">S/ ${paid.toFixed(2)}</td></tr>
  <tr><td>Vuelto:</td><td class="r">S/ ${change.toFixed(2)}</td></tr>
</tbody></table>
<div class="sep"></div>
<p class="c" style="font-size:7.5pt;word-break:break-word;">${amountInWords(total)}</p>
<div class="sep"></div>
${qrDataUrl ? `<img class="qr-img" src="${qrDataUrl}" alt="QR SUNAT" />` : ""}
<div class="sep"></div>
<p class="c b" style="font-size:7pt;line-height:1.5;">BORRADOR SIN VALIDEZ TRIBUTARIA<br/>NO ENVIADO A SUNAT</p>
<p class="c b" style="margin-top:3mm;font-size:9pt;">Gracias por su compra!</p>
</body></html>`;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SaleReceiptModal({ sale, onClose }) {
  const [docType] = useState(() =>
    ["factura", "boleta"].includes(sale?.documentType)
      ? sale.documentType
      : "note",
  );
  const [docNumber, setDocNumber] = useState(null);
  const [loadingDocNum, setLoadingDocNum] = useState(true);
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [bagCount, setBagCount] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const receiptRef = useRef(null);

  const series =
    docType === "factura"
      ? company.facturaSeries || "F001"
      : docType === "boleta"
        ? company.boletaSeries || "B001"
        : "NV01";
  const taxes = calcTaxes(sale?.items || [], bagCount);
  const total = Number(sale?.totalValue) || 0;
  const paid = Number(sale?.amountPaid) || total;
  const change = Math.max(0, paid - total);
  const fullDocNumber = docNumber
    ? `${series}-${String(docNumber).padStart(8, "0")}`
    : "---";

  // QR data (formato SUNAT)
  const tipoComp = docType === "factura" ? "01" : docType === "boleta" ? "03" : "";
  const customerDocument = sale?.documentRUC || sale?.customerDNI || "";
  const tipoDocAdq = !customerDocument
    ? "0"
    : customerDocument.length === 11
      ? "6"
      : "1";
  const payDate = sale?.paymentDate
    ? sale.paymentDate.toDate
      ? sale.paymentDate.toDate()
      : new Date(sale.paymentDate)
    : new Date();
  const qrRawData = docNumber && tipoComp
    ? [
        company.ruc,
        tipoComp,
        series,
        String(docNumber),
        taxes.igv.toFixed(2),
        (total + taxes.icbper).toFixed(2),
        payDate.toISOString().split("T")[0],
        tipoDocAdq,
        customerDocument,
        "",
      ].join("|")
    : "";
  const qrDataUrl = useQRCode(qrRawData);

  // Cargar configuración pública y preparar un correlativo de borrador.
  // No se consume numeración fiscal hasta implementar firma y envío.
  useEffect(() => {
    if (!sale) return;
    const load = async () => {
      setLoadingDocNum(true);
      try {
        const snapshot = await getDoc(doc(db, "settings", "sunat"));
        if (snapshot.exists()) setCompany((current) => ({ ...current, ...snapshot.data() }));
      } catch (error) {
        console.error("Error loading fiscal config:", error);
      } finally {
        const ticketDigits = String(sale.ticketNumber || "").replace(/\D/g, "").slice(-8);
        setDocNumber(Number(sale.fiscalDraftNumber || ticketDigits || 1));
        setLoadingDocNum(false);
      }
    };
    load();
  }, [sale]);

  // ── Imprimir (iframe 80mm) ────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!docNumber || loadingDocNum) return;
    setIsPrinting(true);
    const html = buildPrintHTML({
      company,
      sale,
      docType,
      docSeries: series,
      docNumber,
      taxes,
      qrDataUrl,
      bagCount,
    });
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        setIsPrinting(false);
      }, 2500);
    }, 600);
  }, [
    sale,
    docType,
    series,
    docNumber,
    taxes,
    qrDataUrl,
    bagCount,
    loadingDocNum,
    company,
  ]);

  // ── Generar PDF ────────────────────────────────────────────────────────────
  const handlePDF = useCallback(async () => {
    if (!docNumber || loadingDocNum || !receiptRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const widthMm = 80;
      const heightMm = (canvas.height * widthMm) / canvas.width;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [widthMm, heightMm],
      });
      pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
      pdf.save(`comprobante-${fullDocNumber}.pdf`);
    } catch (err) {
      console.error("Error PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [docNumber, loadingDocNum, fullDocNumber]);

  if (!sale) return null;

  const customerMode = getCustomerMode(sale);
  const dateStr = payDate.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = payDate.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3">
      <div className="w-full max-w-4xl max-h-[96vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">
                receipt_long
              </span>
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">
                {docType === "note" ? "Nota de venta interna" : "Borrador de comprobante"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {loadingDocNum ? "Generando número..." : fullDocNumber} · Ticket{" "}
                {sale.ticketNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Panel izquierdo: controles */}
          <div className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 p-5 flex flex-col gap-4 overflow-y-auto">
            {/* Tipo de documento */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Tipo de Documento
              </label>
              <div className="flex flex-col gap-1.5">
                {[
                  {
                    value: "boleta",
                    label: "Boleta de Venta Electrónica",
                    series: "B001",
                  },
                  {
                    value: "factura",
                    label: "Factura de Venta Electrónica",
                    series: "F001",
                  },
                  { value: "note", label: "Nota de Venta Interna", series: "NV01" },
                ].filter((opt) => opt.value === docType).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      docType === opt.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div
                      className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${docType === opt.value ? "border-primary" : "border-slate-300"}`}
                    >
                      {docType === opt.value && (
                        <div className="size-2 rounded-full bg-primary"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-slate-400 font-normal">
                        {opt.series}-XXXXXXXX
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Número de documento */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                N° Documento
              </label>
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {loadingDocNum ? (
                  <span className="text-slate-400 text-sm animate-pulse">
                    Generando...
                  </span>
                ) : (
                  <span className="font-black text-primary text-sm">
                    {fullDocNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Bolsas plásticas ICBPER */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Bolsas Plásticas (ICBPER)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBagCount((b) => Math.max(0, b - 1))}
                  className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    remove
                  </span>
                </button>
                <input
                  type="number"
                  value={bagCount}
                  min={0}
                  onChange={(e) =>
                    setBagCount(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="flex-1 text-center text-sm font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 outline-none focus:border-primary"
                />
                <button
                  onClick={() => setBagCount((b) => b + 1)}
                  className="size-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                S/ {ICBPER_UNIT_AMOUNT.toFixed(2)} por bolsa = S/ {(bagCount * ICBPER_UNIT_AMOUNT).toFixed(2)}
              </p>
            </div>

            {/* Resumen de totales */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-1.5 text-xs">
              {taxes.exonerated > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Op. Exonerada</span>
                  <span>S/ {taxes.exonerated.toFixed(2)}</span>
                </div>
              )}
              {taxes.igvBase > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Op. Gravada</span>
                  <span>S/ {taxes.igvBase.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>IGV 18%</span>
                <span>S/ {taxes.igv.toFixed(2)}</span>
              </div>
              {bagCount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>ICBPER</span>
                  <span>S/ {taxes.icbper.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1.5">
                <span>TOTAL</span>
                <span>S/ {(total + taxes.icbper).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Vuelto</span>
                <span>S/ {change.toFixed(2)}</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col gap-2.5 mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] leading-relaxed text-slate-500">
                Este es un ticket interno de Caja. La emisión fiscal se realiza únicamente desde Ventas / Bandeja SUNAT.
              </p>
              <button
                onClick={handlePrint}
                disabled={isPrinting || loadingDocNum}
                className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-slate-900/10"
              >
                {isPrinting ? (
                  <span className="material-symbols-outlined animate-spin text-base">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-base">
                    print
                  </span>
                )}
                Imprimir Ticket (80mm)
              </button>
              <button
                onClick={handlePDF}
                disabled={isGeneratingPdf || loadingDocNum}
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-rose-500 text-rose-500 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <span className="material-symbols-outlined animate-spin text-base">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-base">
                    picture_as_pdf
                  </span>
                )}
                Descargar PDF
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>

          {/* Panel derecho: vista previa del ticket */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex items-start justify-center">
            <div
              ref={receiptRef}
              style={{
                width: "302px",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "9pt",
                color: "#000",
                background: "#fff",
                padding: "10px 8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              {/* Cabecera empresa */}
              <div style={{ textAlign: "center", marginBottom: "6px" }}>
                <img
                  src="/img/brand/logo-jieda.png"
                  alt="Logo"
                  crossOrigin="anonymous"
                  style={{
                    maxWidth: "80px",
                    height: "auto",
                    display: "block",
                    margin: "0 auto 4px",
                  }}
                />
                <div style={{ fontWeight: "bold", fontSize: "11pt" }}>
                  {company.razonSocial || company.name}
                </div>
                <div>RUC: {company.ruc || "NO CONFIGURADO"}</div>
                <div style={{ fontSize: "8pt" }}>{company.direccion || company.address}</div>
                <div style={{ fontSize: "8pt" }}>Tel: {company.phone}</div>
                <div style={{ fontSize: "8pt" }}>{company.web}</div>
              </div>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Tipo y número de doc */}
              <div
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  lineHeight: "1.5",
                }}
              >
                <div style={{ fontSize: "8.5pt" }}>
                  {docType === "factura"
                    ? "FACTURA DE VENTA ELECTRONICA"
                    : docType === "boleta"
                      ? "BOLETA DE VENTA ELECTRONICA"
                      : "NOTA DE VENTA INTERNA"}
                </div>
                <div style={{ fontSize: "10pt" }}>
                  {loadingDocNum ? "..." : fullDocNumber}
                </div>
              </div>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Datos del cliente */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "8.5pt",
                }}
              >
                <tbody>
                  {customerMode === "eventual" && (
                    <tr>
                      <td colSpan={2}>
                        <b>Cliente:</b> CLIENTE EVENTUAL
                      </td>
                    </tr>
                  )}
                  {customerMode === "empresa" && (
                    <>
                      <tr>
                        <td style={{ width: "40%", verticalAlign: "top" }}>
                          <b>Razón Social:</b>
                        </td>
                        <td>{sale.customerName}</td>
                      </tr>
                      <tr>
                        <td>
                          <b>RUC:</b>
                        </td>
                        <td>{sale.customerDNI}</td>
                      </tr>
                    </>
                  )}
                  {customerMode === "natural" && (
                    <>
                      <tr>
                        <td style={{ width: "40%", verticalAlign: "top" }}>
                          <b>Cliente:</b>
                        </td>
                        <td>{sale.customerName || "CLIENTE GENERAL"}</td>
                      </tr>
                      {sale.customerDNI && (
                        <tr>
                          <td>
                            <b>DNI:</b>
                          </td>
                          <td>{sale.customerDNI}</td>
                        </tr>
                      )}
                    </>
                  )}
                  <tr>
                    <td>
                      <b>Fecha:</b>
                    </td>
                    <td>{dateStr}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>Hora:</b>
                    </td>
                    <td>{timeStr}</td>
                  </tr>
                  <tr>
                    <td>
                      <b>Vendedor:</b>
                    </td>
                    <td>{sale.sellerName || sale.userName || "---"}</td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Productos */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "8pt",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #000" }}>
                    <th style={{ textAlign: "left", paddingBottom: "2px" }}>
                      Cód
                    </th>
                    <th style={{ textAlign: "left" }}>Cant</th>
                    <th style={{ textAlign: "right" }}>P.U.</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items || []).map((item, i) => {
                    const exo = item.isExonerated ? " [EXO]" : "";
                    const modeStr =
                      item.saleMode === "cajas"
                        ? `${item.quantitySoldBoxes} cj`
                        : item.saleMode === "docenas"
                          ? `${Math.round((item.quantitySoldUnits || 0) / 12)} doc`
                          : `${item.quantitySoldUnits} und`;
                    const pricePer = (
                      Number(item.activePrice) ||
                      Number(item.unitPrice) ||
                      0
                    ).toFixed(2);
                    const sub = Number(item.subtotal).toFixed(2);
                    const code =
                      item.sku || (item.productId || "").slice(0, 6) || "--";
                    return (
                      <React.Fragment key={i}>
                        <tr>
                          <td
                            colSpan={4}
                            style={{ paddingTop: "3px", fontWeight: "bold" }}
                          >
                            {item.productName}
                            {exo}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: "#666", fontSize: "7.5pt" }}>
                            {code}
                          </td>
                          <td>{modeStr}</td>
                          <td style={{ textAlign: "right" }}>S/{pricePer}</td>
                          <td style={{ textAlign: "right" }}>S/{sub}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Bloque tributario */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "8.5pt",
                }}
              >
                <tbody>
                  {taxes.exonerated > 0 && (
                    <tr>
                      <td>Op. Exonerada:</td>
                      <td style={{ textAlign: "right" }}>
                        S/ {taxes.exonerated.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {taxes.igvBase > 0 && (
                    <tr>
                      <td>Op. Gravada:</td>
                      <td style={{ textAlign: "right" }}>
                        S/ {taxes.igvBase.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>IGV (18%):</td>
                    <td style={{ textAlign: "right" }}>
                      S/ {taxes.igv.toFixed(2)}
                    </td>
                  </tr>
                  {bagCount > 0 && (
                    <tr>
                      <td>ICBPER ({bagCount}×S/{ICBPER_UNIT_AMOUNT.toFixed(2)}):</td>
                      <td style={{ textAlign: "right" }}>
                        S/ {taxes.icbper.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div
                style={{ borderTop: "1px solid #000", margin: "3px 0" }}
              ></div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: "bold", fontSize: "11pt" }}>
                      TOTAL:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: "bold",
                        fontSize: "11pt",
                      }}
                    >
                      S/ {(total + taxes.icbper).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Forma de pago */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "8.5pt",
                }}
              >
                <tbody>
                  <tr>
                    <td>Forma de Pago:</td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                      {sale.paymentMethod || "EFECTIVO"}
                    </td>
                  </tr>
                  <tr>
                    <td>Monto Recibido:</td>
                    <td style={{ textAlign: "right" }}>S/ {paid.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Vuelto:</td>
                    <td style={{ textAlign: "right" }}>
                      S/ {change.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Monto en letras */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: "7.5pt",
                  padding: "2px 0",
                  wordBreak: "break-word",
                }}
              >
                {amountInWords(total + taxes.icbper)}
              </div>

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* QR SUNAT */}
              {qrDataUrl ? (
                <div style={{ textAlign: "center", margin: "4px 0" }}>
                  <img
                    src={qrDataUrl}
                    alt="QR SUNAT"
                    style={{
                      width: "90px",
                      height: "90px",
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: "7pt",
                    color: "#999",
                    padding: "4px 0",
                  }}
                >
                  {loadingDocNum ? "Generando QR..." : "QR no disponible"}
                </div>
              )}

              <div
                style={{ borderTop: "1px dashed #000", margin: "5px 0" }}
              ></div>

              {/* Pie de página */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: "7pt",
                  lineHeight: "1.6",
                }}
              >
                <div><b>BORRADOR SIN VALIDEZ TRIBUTARIA</b></div>
                <div>NO ENVIADO A SUNAT</div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: "9.5pt",
                  marginTop: "5px",
                }}
              >
                ¡Gracias por su compra!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
