/**
 * ProductLabel — professional printable product label with QR code.
 *
 * Props:
 *   product        {object}  — Firestore product document
 *   initialFormat  {string}  — 'small' | 'medium' | 'premium' | 'a4' | 'horizontal'
 *   onClose        {fn}      — called when the modal X is clicked
 *
 * Features:
 *   • Live label preview (React + Tailwind)
 *   • QR code pointing to the product's page on the public Dechy catalog
 *   • Browser print (window.print) with dedicated CSS
 *   • PDF export (jsPDF drawing primitives — no html2canvas needed)
 *   • PNG download (canvas rendering)
 *   • Multiple label formats, shared with the Print Center batch actions
 */
import {
  Check,
  Download,
  FileText,
  Layers,
  Printer,
  QrCode,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  generateCatalogProductQR,
  getCatalogProductUrl,
} from "../../utils/productUtils";
import { RENDERERS } from "./labelTemplates";
import {
  FORMATS,
  exportLabelPDF,
  getPrice,
  getSalePrice,
} from "./labelData";

/* ══════════════════════════════════════════
   PNG EXPORT (canvas)
   ══════════════════════════════════════════ */
async function exportLabelPNG(labelRef) {
  const node = labelRef.current?.querySelector("#label-preview-inner");
  if (!node) return;
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
const ProductLabel = ({ product, initialFormat = "medium", onClose }) => {
  const [format, setFormat] = useState(initialFormat);
  const [qrUrl, setQrUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const labelRef = useRef(null);

  /* Generate QR on mount and when product changes */
  useEffect(() => {
    if (!product?.id) return;
    generateCatalogProductQR(product.slug, product.id, product.branch, {
      dark: "#0F172A",
      light: "#FFFFFF",
      width: 300,
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [product?.id, product?.slug, product?.branch]);

  const LabelComp = RENDERERS[format] || RENDERERS.medium;
  const productUrl = getCatalogProductUrl(product?.slug, product?.id, product?.branch);

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
              <LabelComp product={product} qrUrl={qrUrl} publicUrl={productUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductLabel;
