/**
 * PrintCenter — batch label printing for multiple products.
 *
 * Route: /inventario/etiquetas
 * Features:
 *   • Select products from inventory (checkboxes)
 *   • Choose a label format (shared with the single-product preview)
 *   • Preview a single label
 *   • Print all / export a multi-page batch PDF — both reuse the exact
 *     same professional designs and always include a working QR code
 *     pointing to the product's page on the public Dechy catalog.
 */
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { RENDERERS } from "../components/labels/labelTemplates";
import { FORMATS, exportBatchLabelsPDF } from "../components/labels/labelData";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { generateCatalogProductQR, getCatalogProductUrl } from "../utils/productUtils";

const PrintCenter = () => {
  const { currentBranch } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [format, setFormat] = useState("medium");
  const [previewProduct, setPreviewProduct] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [printJob, setPrintJob] = useState(null);
  const hiddenRef = useRef(null);

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

  /* Generates a catalog QR for every selected product, keyed by product id */
  const buildQrMap = async (list) => {
    const entries = await Promise.all(
      list.map(async (p) => [
        p.id,
        await generateCatalogProductQR(p.slug, p.id, p.branch, { width: 240 }),
      ]),
    );
    return Object.fromEntries(entries);
  };

  /* Batch PDF export — one page per product, same designs as the preview */
  const handleBatchPDF = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Selecciona al menos un producto.");
      return;
    }
    setBatchLoading(true);
    try {
      toast.loading("Generando códigos QR…", { id: "batch-pdf" });
      const qrMap = await buildQrMap(selectedProducts);
      await exportBatchLabelsPDF(selectedProducts, format, qrMap, (done, total) => {
        toast.loading(`Generando PDF ${done}/${total}…`, { id: "batch-pdf" });
      });
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

  /* Batch print — renders the real label designs off-screen, then prints them */
  const handleBatchPrint = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Selecciona al menos un producto.");
      return;
    }
    setBatchLoading(true);
    try {
      const qrMap = await buildQrMap(selectedProducts);
      setPrintJob({ products: selectedProducts, qrMap });
    } catch (err) {
      console.error(err);
      toast.error("Error al preparar la impresión.");
    } finally {
      setBatchLoading(false);
    }
  };

  /* Once the hidden batch render commits, grab its markup and open the print window */
  useEffect(() => {
    if (!printJob) return;
    const id = requestAnimationFrame(() => {
      const nodes = printJob.products
        .map((p) => hiddenRef.current?.querySelector(`#batch-label-${p.id} #label-preview-inner`))
        .filter(Boolean)
        .map((node) => node.outerHTML);

      if (nodes.length === 0) {
        setPrintJob(null);
        return;
      }

      const printWin = window.open("", "_blank", "width=1000,height=1200");
      printWin.document.write(`
        <html>
          <head>
            <title>Etiquetas — Dechy</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet"/>
            <style>
              @page { margin: 10mm; }
              body { margin: 0; background: white; }
              .grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: flex-start; }
              .grid > div { page-break-inside: avoid; break-inside: avoid; }
              img { max-width: 100%; }
            </style>
          </head>
          <body>
            <div class="grid">${nodes.map((html) => `<div>${html}</div>`).join("")}</div>
            <script>window.onload = () => { window.print(); window.close(); }<\/script>
          </body>
        </html>
      `);
      printWin.document.close();
      setPrintJob(null);
    });
    return () => cancelAnimationFrame(id);
  }, [printJob]);

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
                  disabled={batchLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
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

      {/* Off-screen render used to build the batch print job's HTML */}
      {printJob && (
        <div
          ref={hiddenRef}
          style={{ position: "fixed", top: 0, left: -99999, pointerEvents: "none" }}
          aria-hidden="true"
        >
          {printJob.products.map((p) => {
            const LabelComp = RENDERERS[format] || RENDERERS.medium;
            return (
              <div key={p.id} id={`batch-label-${p.id}`}>
                <LabelComp
                  product={p}
                  qrUrl={printJob.qrMap[p.id]}
                  publicUrl={getCatalogProductUrl(p.slug, p.id, p.branch)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Label preview modal */}
      {previewProduct && (
        <ProductLabel
          product={previewProduct}
          initialFormat={format}
          onClose={() => setPreviewProduct(null)}
        />
      )}
    </AppLayout>
  );
};

export default PrintCenter;
