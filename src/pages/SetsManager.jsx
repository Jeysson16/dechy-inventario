import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import toast from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db, storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

/* ─────────────────── helpers ─────────────────── */
const COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#f97316","#ec4899",
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
      (snap) => onProgress && onProgress((snap.bytesTransferred / snap.totalBytes) * 100),
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
  <div className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700 ${className}`} />
);

/* ─────────────────── SetForm (panel) ─────────────────── */
const EMPTY_FORM = {
  name: "",
  sku: "",
  description: "",
  price: "",
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
      return { file: null, preview: url, type, mediaType, isMain: url === set.mainImageUrl || url === set.imageUrl };
    });
  }
  if (set?.imageUrl) {
    return [{ file: null, preview: set.imageUrl, type: "primaria", mediaType: isVideoUrlSet(set.imageUrl) ? "video" : "image", isMain: true }];
  }
  return [];
};

const SetForm = ({ editing, allProducts, productMap, branchId, onSave, onCancel }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [components, setComponents] = useState([]);
  const [images, setImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name || "",
        sku: editing.sku || "",
        description: editing.description || "",
        price: editing.price || editing.unitPrice || "",
      });
      setComponents(editing._components || []);
      setImages(imagesFromSet(editing));
    } else {
      setForm(EMPTY_FORM);
      setComponents([]);
      setImages([]);
    }
    setSearch("");
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
    const existingImageCount = images.filter((i) => i.mediaType !== "video").length;
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
      prev.map((img, i) => ({ ...img, isMain: i === idx, type: i === idx ? "primaria" : img.type === "primaria" ? "complementarias" : img.type })),
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
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      await onSave({ form, components, computedStock, images });
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
            <div className="mt-3 grid grid-cols-3 gap-2">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    img.isMain
                      ? "border-primary shadow-sm"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                  style={{ animation: `setCardIn 0.25s cubic-bezier(.22,1,.36,1) ${idx * 0.04}s both` }}
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
                      <span className="material-symbols-outlined text-[10px]">videocam</span>
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
                      <option value="primaria" className="text-slate-900">Primaria</option>
                      <option value="complementarias" className="text-slate-900">Complementaria</option>
                      <option value="textura" className="text-slate-900">Textura</option>
                      <option value="uso" className="text-slate-900">Uso</option>
                      <option value="imagen referencial" className="text-slate-900">Referencial</option>
                      <option value="medidas" className="text-slate-900">Medidas</option>
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
              </button>            </div>
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
                  <p className="text-[10px] text-slate-500">ahorro vs. individual</p>
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
                    {" "}→ Set:{" "}
                    <span className="font-bold text-primary">
                      S/ {Number(form.price).toFixed(2)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}
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
    if (!q) return sets;
    return sets.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.sku?.toLowerCase().includes(q),
    );
  }, [sets, search]);

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
  const handleSave = async ({ form, components, computedStock, images }) => {
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
        computedStock,
        componentsCount: components.length,
        componentsSummary: components.map((c) => c.productName),
        status:
          computedStock === 0
            ? "Agotado"
            : computedStock < 5
              ? "Stock Bajo"
              : "Disponible",
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
        editingSet ? "Set actualizado correctamente." : "Set creado correctamente.",
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
                Nuevo Set
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
                              S/ {Number(set.price || set.unitPrice || 0).toLocaleString()}
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
                                  style={{ background: COLORS[ci % COLORS.length] }}
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
                          <button
                            onClick={() => openEdit(set)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Editar set →
                          </button>
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
            style={{ animation: "panelSlideIn 0.3s cubic-bezier(.22,1,.36,1) both" }}
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
              style={{ animation: "setCardIn 0.2s cubic-bezier(.22,1,.36,1) both" }}
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
