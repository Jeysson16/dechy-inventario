/**
 * PrintCenter — batch label printing for multiple products.
 *
 * Route: /inventario/etiquetas
 * Features:
 *   • Select products from inventory (checkboxes)
 *   • Choose label format
 *   • Preview selected labels
 *   • Print all / Export batch PDF
 */
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Printer,
  FileText,
  Tag,
  Search,
  CheckSquare,
  Square,
  X,
  Package,
  QrCode,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import ProductLabel from "../components/labels/ProductLabel";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const FORMATS = [
  { id: "medium", label: "Mediana", desc: "Exhibición" },
  { id: "small", label: "Pequeña", desc: "Estantería" },
  { id: "premium", label: "Premium", desc: "Showroom" },
  { id: "a4", label: "A4", desc: "Impresión" },
  { id: "horizontal", label: "Horizontal", desc: "Banner" },
];

const PrintCenter = () => {
  const { currentBranch } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [format, setFormat] = useState("medium");
  const [previewProduct, setPreviewProduct] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  /* Load products */
  useEffect(() => {
    if (!currentBranch?.id) return;
    setLoading(true);
    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(
        data.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      );
      setLoading(false);
    });
    return unsub;
  }, [currentBranch?.id]);

  /* Filtered list */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(term) ||
        (p.sku || "").toLowerCase().includes(term) ||
        (p.category || "").toLowerCase().includes(term),
    );
  }, [products, search]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected],
  );

  /* Batch PDF export */
  const handleBatchPDF = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Selecciona al menos un producto.");
      return;
    }
    setBatchLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const QRCode = (await import("qrcode")).default;
      const { getProductPublicUrl } = await import("../utils/productUtils");

      // A4 landscape, one label per page
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();

      for (let idx = 0; idx < selectedProducts.length; idx++) {
        const p = selectedProducts[idx];
        if (idx > 0) doc.addPage();

        /* Background */
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, PW, PH, "F");

        const img =
          p?.mainImageUrl || p?.imageUrl || p?.imageUrls?.[0]?.url || null;
        const imgH = PH * 0.38;
        if (img) {
          try {
            doc.addImage(img, "JPEG", 0, 0, PW, imgH, undefined, "FAST");
          } catch {}
        }

        /* Overlay */
        doc.setFillColor(15, 23, 42);
        doc.setGState(new doc.GState({ opacity: 0.55 }));
        doc.rect(0, imgH * 0.55, PW, imgH * 0.45, "F");
        doc.setGState(new doc.GState({ opacity: 1 }));

        let y = imgH + 20;

        /* Brand */
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(207, 174, 112);
        doc.text("DECHY", 22, y);
        y += 16;

        /* Category */
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          (p.category || "") + (p.subcategory ? ` / ${p.subcategory}` : ""),
          22,
          y,
        );
        y += 15;

        /* Name */
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(248, 250, 252);
        const nameLines = doc.splitTextToSize(p.name || "", PW - 44 - 90);
        doc.text(nameLines, 22, y);
        y += nameLines.length * 22 + 8;

        /* SKU */
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`SKU: ${p.sku || "—"}`, 22, y);
        y += 16;

        /* Price */
        const price = Number(p?.unitPrice || p?.price || 0);
        const saleP =
          p?.isOnSale && p?.salePrice > 0 ? Number(p.salePrice) : null;
        const disc = p?.discountPercent || 0;

        doc.setFillColor(25, 37, 60);
        doc.roundedRect(22, y, PW - 44, 44, 6, 6, "F");
        if (saleP) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184);
          doc.text(`S/ ${price.toFixed(2)}`, 32, y + 15);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(22);
          doc.setTextColor(251, 113, 133);
          doc.text(`S/ ${saleP.toFixed(2)}`, 32, y + 36);
          if (disc) {
            doc.setFillColor(207, 174, 112);
            doc.roundedRect(PW - 80, y + 10, 50, 20, 10, 10, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(`-${disc}%`, PW - 68, y + 24);
          }
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(207, 174, 112);
          doc.text(`S/ ${price.toFixed(2)}`, 32, y + 32);
        }
        y += 56;

        /* QR */
        const qrUrl = await QRCode.toDataURL(
          getProductPublicUrl(p.slug, p.id),
          {
            width: 140,
            margin: 1,
            errorCorrectionLevel: "H",
            color: { dark: "#0F172A", light: "#FFFFFF" },
          },
        );
        const qrSz = 80;
        const qrX = PW - 22 - qrSz;
        const qrY = PH - 22 - qrSz - 16;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(qrX - 4, qrY - 4, qrSz + 8, qrSz + 8, 5, 5, "F");
        doc.addImage(qrUrl, "PNG", qrX, qrY, qrSz, qrSz);
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Escanea y compra", qrX - 4, qrY + qrSz + 12);

        /* Footer */
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.5);
        doc.line(22, PH - 26, PW - 22, PH - 26);
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          "www.dechy.pe  ·  +51 999 999 999  ·  @dechystore",
          22,
          PH - 12,
        );

        /* Progress */
        toast.loading(`Generando PDF ${idx + 1}/${selectedProducts.length}…`, {
          id: "batch-pdf",
        });
      }

      doc.save(`etiquetas-batch-${Date.now()}.pdf`);
      toast.success(`PDF generado con ${selectedProducts.length} etiquetas.`, {
        id: "batch-pdf",
      });
    } catch (err) {
      console.error(err);
      toast.error("Error al generar PDF.", { id: "batch-pdf" });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchPrint = () => {
    if (selectedProducts.length === 0) {
      toast.error("Selecciona al menos un producto.");
      return;
    }
    // Open print window with simple grid of labels
    const printWin = window.open("", "_blank", "width=900,height=1100");
    const items = selectedProducts
      .map(
        (p) => `
      <div style="page-break-inside:avoid; break-inside:avoid; padding:8px;">
        <div style="border:1px solid #334155; border-radius:12px; background:#0F172A; color:white; padding:16px; font-family:Inter,sans-serif; max-width:340px;">
          <p style="color:#CFAE70; font-weight:900; font-size:10px; letter-spacing:2px; text-transform:uppercase; margin:0 0 2px;">DECHY</p>
          <p style="color:#94a3b8; font-size:9px; margin:0 0 6px;">${p.category || ""}${p.subcategory ? " / " + p.subcategory : ""}</p>
          <h3 style="color:#f8fafc; font-size:16px; font-weight:900; margin:0 0 4px; line-height:1.2;">${p.name || ""}</h3>
          <p style="color:#64748b; font-size:9px; font-family:monospace; margin:0 0 10px;">SKU: ${p.sku || "—"}</p>
          <p style="color:#CFAE70; font-size:22px; font-weight:900; margin:0 0 8px;">S/ ${Number(p?.isOnSale && p?.salePrice > 0 ? p.salePrice : p?.unitPrice || p?.price || 0).toFixed(2)}</p>
          <p style="color:#475569; font-size:8px; margin:0;">www.dechy.pe</p>
        </div>
      </div>
    `,
      )
      .join("");

    printWin.document.write(`
      <html>
        <head>
          <title>Etiquetas — Dechy</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet"/>
          <style>
            @page { margin: 12mm; }
            body { margin:0; background:white; }
            .grid { display:flex; flex-wrap:wrap; gap:0; }
          </style>
        </head>
        <body>
          <div class="grid">${items}</div>
          <script>window.onload=()=>{window.print();window.close();}<\/script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Tag size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                Centro de Impresión
              </h1>
              <p className="text-sm text-slate-500">
                Genera y imprime etiquetas profesionales
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
            </span>
            {selected.size > 0 && (
              <>
                <button
                  onClick={handleBatchPrint}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
                >
                  <Printer size={14} /> Imprimir
                </button>
                <button
                  onClick={handleBatchPDF}
                  disabled={batchLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  <FileText size={14} />{" "}
                  {batchLoading ? "Generando…" : "PDF Lote"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Format selector */}
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                format === f.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {f.label}
              <span
                className={`text-xs ${format === f.id ? "text-indigo-200" : "text-slate-400"}`}
              >
                {f.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Search + select all */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-2.5 text-slate-400 pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o categoría…"
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {selected.size === filtered.length && filtered.length > 0 ? (
              <CheckSquare size={16} className="text-indigo-500" />
            ) : (
              <Square size={16} />
            )}
            {selected.size === filtered.length && filtered.length > 0
              ? "Deseleccionar todo"
              : "Seleccionar todo"}
          </button>
        </div>

        {/* Product list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => {
              const isSelected = selected.has(product.id);
              const price = Number(
                product?.isOnSale && product?.salePrice > 0
                  ? product.salePrice
                  : product?.unitPrice || product?.price || 0,
              );
              const img =
                product?.mainImageUrl ||
                product?.imageUrl ||
                product?.imageUrls?.[0]?.url ||
                null;

              return (
                <div
                  key={product.id}
                  onClick={() => toggle(product.id)}
                  className={`relative rounded-xl border cursor-pointer transition-all overflow-hidden group ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/30"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`absolute top-2.5 left-2.5 z-10 size-5 rounded-md flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-indigo-500"
                        : "bg-white/80 dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isSelected && (
                      <span className="text-white text-[10px]">✓</span>
                    )}
                  </div>

                  {/* Image */}
                  <div className="h-28 overflow-hidden bg-slate-100 dark:bg-slate-700">
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={28} className="text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {product.category}
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight line-clamp-2 mt-0.5">
                      {product.name}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p className="text-xs font-mono text-slate-400">
                          {product.sku || "—"}
                        </p>
                        <p className="text-sm font-black text-indigo-500">
                          S/ {price.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewProduct(product);
                        }}
                        className="size-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-500 hover:text-indigo-500 transition-colors"
                        title="Vista previa de etiqueta"
                      >
                        <QrCode size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <Tag size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* Label preview modal */}
      {previewProduct && (
        <ProductLabel
          product={previewProduct}
          onClose={() => setPreviewProduct(null)}
        />
      )}
    </AppLayout>
  );
};

export default PrintCenter;
