import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import React, { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useBranchCatalogProducts } from "../hooks/useBranchCatalogProducts";
import { companyLogoToDataUrl, useCompanyInfo } from "../utils/companyInfo";
import { amountInWords } from "../utils/numberToWords";
import { matchesAnyFuzzy } from "../utils/search";

const VALIDITY_OPTIONS = [7, 15, 30];

const genQuoteNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `COT-${y}${m}${d}-${rand}`;
};

const emptyDraft = () => ({
  customerName: "",
  customerPhone: "",
  customerDocument: "",
  validityDays: 15,
  notes: "",
  items: [],
});

const isExpired = (quote) => {
  const until = quote.validUntil?.toDate ? quote.validUntil.toDate() : new Date(quote.validUntil);
  return until.getTime() < Date.now();
};

function calcQuoteTotals(items) {
  const total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const igvBase = total > 0 ? total / 1.18 : 0;
  const igv = total - igvBase;
  return { total, igvBase, igv };
}

async function buildQuotePdf({ company, quote }) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 12;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const { total, igvBase, igv } = calcQuoteTotals(quote.items || []);

  const logoData = await companyLogoToDataUrl(company.logoPath);
  if (logoData) {
    const format = logoData.includes("image/jpeg") ? "JPEG" : "PNG";
    pdf.addImage(logoData, format, margin, 10, 38, 20, undefined, "FAST");
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(company.razonSocial || company.name || "EMPRESA", pageWidth / 2, 15, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  [
    company.direccion || company.address,
    [company.phone && `Tel: ${company.phone}`, company.email, company.web].filter(Boolean).join(" | "),
  ]
    .filter(Boolean)
    .forEach((line, index) => pdf.text(line, pageWidth / 2, 20 + index * 4, { align: "center" }));

  pdf.roundedRect(pageWidth - margin - 48, 10, 48, 22, 1, 1);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("COTIZACIÓN", pageWidth - margin - 24, 19, { align: "center" });
  pdf.setFontSize(10);
  pdf.text(quote.quoteNumber, pageWidth - margin - 24, 26, { align: "center" });

  const createdDate = quote.createdAtLocal || new Date();
  const validUntilDate = quote.validUntil?.toDate
    ? quote.validUntil.toDate()
    : new Date(quote.validUntil);
  const dateFmt = (d) => d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

  autoTable(pdf, {
    startY: 40,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 }, 2: { fontStyle: "bold", cellWidth: 24 } },
    body: [
      ["Cliente", quote.customerName || "CLIENTE GENERAL", "Teléfono", quote.customerPhone || "-"],
      ["Doc.", quote.customerDocument || "-", "Vendedor", quote.createdByName || "-"],
      ["Fecha", dateFmt(createdDate), "Válida hasta", dateFmt(validUntilDate)],
    ],
  });

  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 4,
    margin: { left: margin, right: margin },
    head: [["Item", "Código", "Producto", "Cant.", "P. Unit.", "Subtotal"]],
    body: (quote.items || []).map((item, index) => [
      String(index + 1).padStart(2, "0"),
      item.sku || "-",
      item.name || "Producto",
      String(item.quantity),
      Number(item.unitPrice).toFixed(2),
      Number(item.subtotal).toFixed(2),
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [235, 238, 242],
      textColor: [15, 23, 42],
      lineColor: [80, 80, 80],
      lineWidth: 0.2,
      halign: "center",
      fontStyle: "bold",
    },
    styles: { fontSize: 7.8, cellPadding: 1.6, lineColor: [90, 90, 90], lineWidth: 0.15, textColor: [20, 20, 20] },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 24 },
      2: { cellWidth: 84 },
      3: { halign: "right", cellWidth: 16 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 22 },
    },
  });

  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 4,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.4, lineWidth: 0.15 },
    columnStyles: {
      0: { fontStyle: "bold", halign: "right" },
      1: { halign: "right", cellWidth: 30 },
    },
    tableWidth: 90,
    margin: { left: pageWidth - margin - 90, right: margin },
    body: [
      ["Valor venta", igvBase.toFixed(2)],
      ["IGV (18%)", igv.toFixed(2)],
      ["TOTAL S/", total.toFixed(2)],
    ],
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
  });

  const wordsY = pdf.lastAutoTable.finalY + 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(amountInWords(total), margin, wordsY, { maxWidth: pageWidth - margin * 2 });

  if (quote.notes) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Observaciones:", margin, wordsY + 8);
    pdf.text(quote.notes, margin, wordsY + 13, { maxWidth: pageWidth - margin * 2 });
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(90, 90, 90);
  pdf.text(
    "Precios incluyen IGV. Cotización referencial sujeta a stock disponible al momento de la compra.",
    pageWidth / 2,
    283,
    { align: "center" },
  );
  pdf.text(
    `Documento no válido como comprobante de pago. Válida hasta el ${dateFmt(validUntilDate)}.`,
    pageWidth / 2,
    288,
    { align: "center" },
  );

  return { pdf, fileName: `${quote.quoteNumber}.pdf` };
}

const toDate = (value) => (value?.toDate ? value.toDate() : new Date(value));

async function downloadQuotePdf({ company, quote }) {
  const { pdf, fileName } = await buildQuotePdf({ company, quote });
  pdf.save(fileName);
}

// Peruvian mobiles are 9 digits: prefix the country code so wa.me opens the chat
const whatsappNumber = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 9 ? `51${digits}` : digits;
};

const quoteShareText = (quote, company) => {
  const greeting = quote.customerName ? `Hola ${quote.customerName.split(" ")[0]}` : "Hola";
  const until = toDate(quote.validUntil).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${greeting}, te compartimos la cotización ${quote.quoteNumber} de ${company.name || company.razonSocial || "nuestra tienda"} por un total de S/ ${Number(quote.total || 0).toFixed(2)} (válida hasta el ${until}).`;
};

// Mobile (and Windows' share sheet): attach the PDF straight into WhatsApp or any app.
// Elsewhere: download the PDF and open the customer's WhatsApp chat ready to attach it.
async function shareQuotePdf({ company, quote }) {
  const { pdf, fileName } = await buildQuotePdf({ company, quote });
  const text = quoteShareText(quote, company);
  const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Cotización ${quote.quoteNumber}`, text });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }
  pdf.save(fileName);
  const phone = whatsappNumber(quote.customerPhone);
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`${text} Te adjunto el PDF.`)}`, "_blank", "noopener");
  return "downloaded";
}

// Catalog "Compartir por QR / enlace" links carry ?cart=<name>:<qty>,... (see catalogo-astro)
const parseCatalogCartLink = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let params;
  try {
    params = new URL(raw).searchParams;
  } catch {
    params = new URLSearchParams(raw.includes("?") ? raw.slice(raw.indexOf("?")) : raw);
  }
  const cart = params.get("cart") || params.get("importCart");
  if (!cart) return null;
  const items = cart.split(",").map((part) => {
    const index = part.lastIndexOf(":");
    if (index === -1) return null;
    return {
      name: decodeURIComponent(part.slice(0, index)).trim(),
      quantity: parseInt(part.slice(index + 1), 10) || 1,
    };
  }).filter(Boolean);
  return {
    items,
    branchId: params.get("branch") || params.get("importBranch") || "",
    customerName: params.get("clientName") || "",
    customerDocument: params.get("clientDNI") || "",
    customerPhone: params.get("clientPhone") || "",
  };
};

const productImage = (product) =>
  product?.images?.[0] || product?.imageUrl || product?.mainImageUrl || "";

function QuoteBuilderModal({ branch, currentUser, userProfile, onClose, onSaved }) {
  const { products, loading: productsLoading } = useBranchCatalogProducts(branch?.id);
  const [draft, setDraft] = useState(emptyDraft());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerFocused, setCustomerFocused] = useState(false);
  const [catalogLink, setCatalogLink] = useState("");
  const [showLinkBox, setShowLinkBox] = useState(false);

  // Saved customers of this branch, to fill name/phone/document in one click
  React.useEffect(() => {
    if (!branch?.id) return undefined;
    const q = query(collection(db, "customers"), where("branchId", "==", branch.id));
    return onSnapshot(
      q,
      (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Error loading customers:", error),
    );
  }, [branch?.id]);

  const customerMatches = useMemo(() => {
    const term = draft.customerName.trim();
    if (!term) return [];
    return customers
      .filter((c) => matchesAnyFuzzy(term, [c.customerName, c.customerDNI, c.phone]))
      .slice(0, 5);
  }, [customers, draft.customerName]);

  // With no search, suggest in-stock products so a quote can start with a couple of clicks
  const visibleProducts = useMemo(() => {
    const list = search.trim()
      ? products.filter((p) => matchesAnyFuzzy(search, [p.name, p.sku, p.category, p.subcategory]))
      : products.filter((p) => Number(p.currentStock) > 0);
    return list.slice(0, 12);
  }, [search, products]);

  const itemQty = (productId) => draft.items.find((i) => i.productId === productId)?.quantity || 0;

  const addItem = (product, quantity = 1) => {
    setDraft((prev) => {
      const existing = prev.items.find((i) => i.productId === product.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: i.quantity + quantity, subtotal: (i.quantity + quantity) * i.unitPrice }
              : i,
          ),
        };
      }
      const unitPrice = Number(product.price || product.unitPrice || 0);
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            productId: product.id,
            sku: product.sku || "",
            name: product.name || "Producto",
            category: product.category || "",
            imageUrl: productImage(product),
            quantity,
            unitPrice,
            subtotal: unitPrice * quantity,
          },
        ],
      };
    });
  };

  const updateItem = (productId, field, value) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((i) => {
        if (i.productId !== productId) return i;
        const next = { ...i, [field]: Math.max(field === "quantity" ? 1 : 0, Number(value) || 0) };
        next.subtotal = next.quantity * next.unitPrice;
        return next;
      }),
    }));
  };

  const removeItem = (productId) => {
    setDraft((prev) => ({ ...prev, items: prev.items.filter((i) => i.productId !== productId) }));
  };

  const pickCustomer = (customer) => {
    setDraft((prev) => ({
      ...prev,
      customerName: customer.customerName || "",
      customerPhone: customer.phone || "",
      customerDocument: customer.customerDNI || "",
    }));
    setCustomerFocused(false);
  };

  // A customer's selection from the public catalog becomes the quote in one paste
  const importCatalogLink = () => {
    const parsed = parseCatalogCartLink(catalogLink);
    if (!parsed || parsed.items.length === 0) {
      toast.error("Ese enlace no tiene una selección del catálogo.");
      return;
    }
    if (parsed.branchId && branch?.id && parsed.branchId !== branch.id) {
      toast.error("Ese pedido es de otra empresa. Cambia a esa empresa para cotizarlo.");
      return;
    }
    const byName = new Map(products.map((p) => [String(p.name || "").trim().toLowerCase(), p]));
    let added = 0;
    const missing = [];
    parsed.items.forEach(({ name, quantity }) => {
      const product = byName.get(name.toLowerCase());
      if (product) {
        addItem(product, quantity);
        added += 1;
      } else {
        missing.push(name);
      }
    });
    setDraft((prev) => ({
      ...prev,
      customerName: prev.customerName || parsed.customerName,
      customerPhone: prev.customerPhone || parsed.customerPhone,
      customerDocument: prev.customerDocument || parsed.customerDocument,
    }));
    if (added) toast.success(`${added} producto${added === 1 ? "" : "s"} agregado${added === 1 ? "" : "s"} desde el catálogo.`);
    if (missing.length) toast.error(`No se encontraron: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
    setCatalogLink("");
    setShowLinkBox(false);
  };

  const { total, igvBase, igv } = calcQuoteTotals(draft.items);

  const handleSave = async () => {
    if (draft.items.length === 0) {
      toast.error("Agrega al menos un producto a la cotización.");
      return;
    }
    setSaving(true);
    try {
      const createdAtLocal = new Date();
      const validUntil = new Date(createdAtLocal);
      validUntil.setDate(validUntil.getDate() + Number(draft.validityDays));
      const payload = {
        branchId: branch.id,
        branchName: branch.name || "",
        quoteNumber: genQuoteNumber(),
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        customerDocument: draft.customerDocument.trim(),
        validityDays: Number(draft.validityDays),
        validUntil,
        notes: draft.notes.trim(),
        items: draft.items,
        total,
        igvBase,
        igv,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid || null,
        createdByName: userProfile?.name || currentUser?.email || "Vendedor",
      };
      await addDoc(collection(db, "quotes"), payload);
      toast.success("Cotización guardada.");
      onSaved({ ...payload, createdAtLocal });
      onClose();
    } catch (error) {
      console.error("Error saving quote:", error);
      toast.error("No se pudo guardar la cotización.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition";
  const stepBtn = "size-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-primary hover:text-white transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3">
      <div className="w-full max-w-6xl h-[94vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">request_quote</span>
            </span>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-base">Nueva cotización</h2>
              <p className="text-xs text-slate-500">Elige los productos, revisa el total y compártela con tu cliente.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── Left: product picker ── */}
          <div className="min-h-0 flex flex-col border-r border-slate-100 dark:border-slate-800">
            <div className="p-5 space-y-3 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Busca por nombre, código o categoría..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkBox((v) => !v)}
                  title="Pegar la selección que el cliente armó en el catálogo web"
                  className={`shrink-0 flex items-center gap-1.5 px-3 rounded-xl border text-xs font-bold transition-colors ${showLinkBox ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary"}`}
                >
                  <span className="material-symbols-outlined text-[18px]">link</span>
                  <span className="hidden sm:inline">Desde el catálogo</span>
                </button>
              </div>
              {showLinkBox && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Pega el enlace que te envió el cliente desde <b>“Compartir por QR / enlace”</b> del catálogo web y sus productos se agregan solos.
                  </p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={catalogLink}
                      onChange={(e) => setCatalogLink(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && importCatalogLink()}
                      placeholder="https://...?cart=..."
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs outline-none focus:border-primary"
                    />
                    <button type="button" onClick={importCatalogLink} className="px-4 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90">
                      Agregar
                    </button>
                  </div>
                </div>
              )}
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {search.trim() ? `Resultados (${visibleProducts.length})` : "Productos con stock"}
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
              {productsLoading && products.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  <span className="material-symbols-outlined text-4xl block mb-2">inventory_2</span>
                  No encontramos productos con “{search}”.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visibleProducts.map((product) => {
                    const qty = itemQty(product.id);
                    const img = productImage(product);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addItem(product)}
                        className={`group relative text-left rounded-2xl border bg-white dark:bg-slate-800/60 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${qty ? "border-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"}`}
                      >
                        <div className="aspect-square bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                          {img ? (
                            <img src={img} alt="" loading="lazy" className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <span className="material-symbols-outlined text-3xl text-slate-300">image</span>
                          )}
                        </div>
                        <div className="p-2.5 space-y-0.5">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">{product.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{product.sku || product.category}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-black text-primary">S/ {Number(product.price || product.unitPrice || 0).toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400">{Number(product.currentStock) || 0} disp.</span>
                          </div>
                        </div>
                        <span className={`absolute top-2 right-2 size-7 rounded-full flex items-center justify-center text-xs font-black shadow transition-colors ${qty ? "bg-primary text-white" : "bg-white/95 text-primary group-hover:bg-primary group-hover:text-white"}`}>
                          {qty || <span className="material-symbols-outlined text-[18px]">add</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: customer + summary ── */}
          <div className="min-h-0 flex flex-col bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <section className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cliente</p>
                <div className="relative">
                  <input
                    value={draft.customerName}
                    onChange={(e) => setDraft((p) => ({ ...p, customerName: e.target.value }))}
                    onFocus={() => setCustomerFocused(true)}
                    onBlur={() => setTimeout(() => setCustomerFocused(false), 150)}
                    placeholder="Nombre del cliente (o busca uno guardado)"
                    className={inputClass.replace("mt-1 ", "")}
                  />
                  {customerFocused && customerMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                      {customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickCustomer(c)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <span className="material-symbols-outlined text-[18px] text-slate-400">person</span>
                          <span className="flex-1 min-w-0">
                            <span className="font-bold block truncate">{c.customerName}</span>
                            <span className="text-slate-400">{[c.customerDNI, c.phone].filter(Boolean).join(" · ")}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={draft.customerPhone}
                    onChange={(e) => setDraft((p) => ({ ...p, customerPhone: e.target.value }))}
                    placeholder="WhatsApp / teléfono"
                    className={inputClass.replace("mt-1 ", "")}
                  />
                  <input
                    value={draft.customerDocument}
                    onChange={(e) => setDraft((p) => ({ ...p, customerDocument: e.target.value }))}
                    placeholder="DNI / RUC (opcional)"
                    className={inputClass.replace("mt-1 ", "")}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Válida por</span>
                  {VALIDITY_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, validityDays: days }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        draft.validityDays === days
                          ? "border-primary bg-primary text-white"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary"
                      }`}
                    >
                      {days} días
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Productos ({draft.items.length})
                </p>
                {draft.items.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-400">
                    Toca un producto de la izquierda para agregarlo.
                  </div>
                ) : (
                  draft.items.map((item) => (
                    <div key={item.productId} className="flex gap-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5">
                      <div className="size-14 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-300">image</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-xs font-bold leading-snug line-clamp-2">{item.name}</p>
                          <button onClick={() => removeItem(item.productId)} title="Quitar" className="text-slate-400 hover:text-rose-500 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => (item.quantity <= 1 ? removeItem(item.productId) : updateItem(item.productId, "quantity", item.quantity - 1))} className={stepBtn}>
                              <span className="material-symbols-outlined text-[16px]">remove</span>
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(item.productId, "quantity", e.target.value)}
                              className="w-12 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent p-1 text-xs font-bold"
                            />
                            <button type="button" onClick={() => updateItem(item.productId, "quantity", item.quantity + 1)} className={stepBtn}>
                              <span className="material-symbols-outlined text-[16px]">add</span>
                            </button>
                          </div>
                          <label className="flex items-center gap-1 text-[11px] text-slate-400">
                            S/
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.productId, "unitPrice", e.target.value)}
                              title="Precio unitario (editable)"
                              className="w-16 text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent p-1 text-xs"
                            />
                          </label>
                          <span className="text-xs font-black w-20 text-right">S/ {item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Observaciones (opcional)</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Tiempo de entrega, forma de pago, instalación..."
                  className={inputClass}
                />
              </label>
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Valor venta</span>
                  <span>S/ {igvBase.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>IGV 18%</span>
                  <span>S/ {igv.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline font-black text-slate-900 dark:text-white pt-1">
                  <span className="text-sm">Total</span>
                  <span className="text-2xl">S/ {total.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || draft.items.length === 0}
                  className="flex-1 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {saving ? "Guardando..." : "Guardar y compartir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// After saving: send the PDF right away (WhatsApp / share sheet) or just download it
function QuoteReadyModal({ quote, company, onClose }) {
  const [busy, setBusy] = useState(null);
  const run = async (kind) => {
    setBusy(kind);
    try {
      if (kind === "share") {
        const result = await shareQuotePdf({ company, quote });
        if (result === "downloaded") toast.success("PDF descargado. Adjúntalo en el chat de WhatsApp que se abrió.");
      } else {
        await downloadQuotePdf({ company, quote });
      }
    } catch (error) {
      console.error("Error building quote PDF:", error);
      toast.error("No se pudo generar el PDF.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 text-center space-y-4">
        <span className="mx-auto size-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">task_alt</span>
        </span>
        <div>
          <h3 className="font-black text-lg">¡Cotización lista!</h3>
          <p className="text-sm text-slate-500 mt-1">
            {quote.quoteNumber} · S/ {Number(quote.total || 0).toFixed(2)}
            {quote.customerName ? ` · ${quote.customerName}` : ""}
          </p>
        </div>
        <button
          onClick={() => run("share")}
          disabled={!!busy}
          className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
          {busy === "share" ? "Preparando..." : "Enviar por WhatsApp"}
        </button>
        <button
          onClick={() => run("download")}
          disabled={!!busy}
          className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          {busy === "download" ? "Generando..." : "Descargar PDF"}
        </button>
        <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function Quotes() {
  const { currentBranch, currentUser, userProfile } = useAuth();
  const { company } = useCompanyInfo(currentBranch?.id);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [search, setSearch] = useState("");
  const [quoteToDelete, setQuoteToDelete] = useState(null);
  const [readyQuote, setReadyQuote] = useState(null);

  React.useEffect(() => {
    if (!currentBranch?.id) return undefined;
    const q = query(collection(db, "quotes"), where("branchId", "==", currentBranch.id));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((item) => rows.push({ id: item.id, ...item.data() }));
        rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setQuotes(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading quotes:", error);
        toast.error("No se pudieron cargar las cotizaciones.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [currentBranch?.id]);

  const filteredQuotes = useMemo(
    () =>
      quotes.filter((quote) =>
        matchesAnyFuzzy(search, [quote.customerName, quote.quoteNumber, quote.customerPhone]),
      ),
    [quotes, search],
  );

  const handleDelete = async () => {
    if (!quoteToDelete) return;
    try {
      await deleteDoc(doc(db, "quotes", quoteToDelete.id));
      toast.success("Cotización eliminada.");
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast.error("No se pudo eliminar la cotización.");
    } finally {
      setQuoteToDelete(null);
    }
  };

  const handleDownload = async (quote) => {
    try {
      await downloadQuotePdf({ company, quote });
    } catch (error) {
      console.error("Error building quote PDF:", error);
      toast.error("No se pudo generar el PDF.");
    }
  };

  const handleShare = async (quote) => {
    try {
      const result = await shareQuotePdf({ company, quote });
      if (result === "downloaded") toast.success("PDF descargado. Adjúntalo en el chat de WhatsApp que se abrió.");
    } catch (error) {
      console.error("Error sharing quote PDF:", error);
      toast.error("No se pudo compartir la cotización.");
    }
  };

  return (
    <AppLayout>
      <div className="min-h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 text-slate-900 dark:text-white">
        <div className="max-w-screen-xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">Ventas</p>
              <h1 className="text-3xl font-black">Cotizaciones</h1>
              <p className="text-sm text-slate-500 mt-1">
                Arma propuestas de precio para tus clientes sin afectar el stock ni generar una venta.
              </p>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:opacity-90 shadow-lg shrink-0"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Nueva cotización
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, teléfono o número de cotización..."
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-3.5 text-sm"
          />

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4">N° Cotización</th>
                    <th className="text-left p-4">Cliente</th>
                    <th className="text-left p-4">Fecha</th>
                    <th className="text-left p-4">Vigencia</th>
                    <th className="text-right p-4">Total</th>
                    <th className="text-right p-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Cargando cotizaciones...
                      </td>
                    </tr>
                  )}
                  {!loading && filteredQuotes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Aún no hay cotizaciones registradas.
                      </td>
                    </tr>
                  )}
                  {filteredQuotes.map((quote) => {
                    const expired = isExpired(quote);
                    const createdDate = quote.createdAt?.toDate ? quote.createdAt.toDate() : null;
                    return (
                      <tr key={quote.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-4 font-bold text-primary">{quote.quoteNumber}</td>
                        <td className="p-4">
                          <div className="font-semibold">{quote.customerName || "Cliente eventual"}</div>
                          {quote.customerPhone && (
                            <div className="text-xs text-slate-400">{quote.customerPhone}</div>
                          )}
                        </td>
                        <td className="p-4 text-slate-500">
                          {createdDate
                            ? createdDate.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
                            : "—"}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              expired
                                ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                            }`}
                          >
                            {expired ? "Vencida" : "Vigente"}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black">S/ {Number(quote.total || 0).toFixed(2)}</td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleShare(quote)}
                              title="Enviar por WhatsApp"
                              className="size-9 flex items-center justify-center rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600"
                            >
                              <span className="material-symbols-outlined text-[18px]">send</span>
                            </button>
                            <button
                              onClick={() => handleDownload(quote)}
                              title="Descargar PDF"
                              className="size-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                            >
                              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                            </button>
                            <button
                              onClick={() => setQuoteToDelete(quote)}
                              title="Eliminar"
                              className="size-9 flex items-center justify-center rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showBuilder && (
        <QuoteBuilderModal
          branch={currentBranch}
          currentUser={currentUser}
          userProfile={userProfile}
          onClose={() => setShowBuilder(false)}
          onSaved={(quote) => setReadyQuote(quote)}
        />
      )}

      {readyQuote && (
        <QuoteReadyModal quote={readyQuote} company={company} onClose={() => setReadyQuote(null)} />
      )}

      {quoteToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 space-y-4">
            <h3 className="font-black text-lg">¿Eliminar cotización?</h3>
            <p className="text-sm text-slate-500">
              Se eliminará permanentemente la cotización {quoteToDelete.quoteNumber}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setQuoteToDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest hover:opacity-90"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
