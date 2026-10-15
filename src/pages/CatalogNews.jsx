import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Sparkles, Trash2, Eye, EyeOff, UploadCloud, PackageCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db, storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { generateSKU, generateSlug } from "../utils/productUtils";

// Upcoming arrivals are regular products with a newsStatus, so the public catalog
// reads them through the already-public products rule. Without stock they stay out
// of the catalog grid and only show (photo + name) in its «Novedades» tab.
//   newsStatus: "proximamente" | "disponible"   newsHidden: hides it from Novedades
const NEWS_COMING = "proximamente";
const NEWS_AVAILABLE = "disponible";

const toMillis = (ts) => (ts?.toMillis ? ts.toMillis() : ts ? new Date(ts).getTime() : 0);

const uploadToStorage = (file, folder, onProgress) => new Promise((resolve, reject) => {
  const path = `${folder}/${Date.now()}_${file.name}`;
  const task = uploadBytesResumable(ref(storage, path), file);
  task.on(
    "state_changed",
    (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
    reject,
    async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
  );
});

// Minimal product: name and photo now; prices and stock get filled in from the
// regular product form once it arrives
const newsProductData = ({ name, imageUrl, storagePath, branchId, newsStatus = NEWS_COMING }) => {
  const sku = generateSKU("");
  return {
    name,
    sku,
    slug: generateSlug(name, sku),
    category: "",
    categoryId: null,
    subcategory: "",
    brand: "",
    measurementUnit: "unidades",
    unitsPerBox: 1,
    unitPrice: 0,
    boxPrice: 0,
    dozenPrice: 0,
    price: 0,
    sellByUnit: true,
    sellByBox: false,
    sellByDozen: false,
    costPrice: 0,
    minStock: 0,
    currentStock: 0,
    stock: 0,
    status: "Agotado",
    visible: true,
    active: true,
    branch: branchId,
    imageUrl,
    mainImageUrl: imageUrl,
    imageUrls: [{ url: imageUrl, type: "principal", mediaType: "image" }],
    newsStatus,
    newsHidden: false,
    newsAddedAt: serverTimestamp(),
    newsStoragePath: storagePath || null,
    createdFromNews: true,
    createdAt: new Date(),
  };
};

const CatalogNews = () => {
  const { currentBranch } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [legacy, setLegacy] = useState([]); // photos from the old catalogNews gallery
  const [migrating, setMigrating] = useState(false);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const branchId = currentBranch?.id;

  useEffect(() => {
    if (!branchId) return undefined;
    setLoading(true);
    const q = query(collection(db, "products"), where("branch", "==", branchId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.newsStatus === NEWS_COMING || p.newsStatus === NEWS_AVAILABLE);
        list.sort((a, b) => toMillis(b.newsAddedAt || b.createdAt) - toMillis(a.newsAddedAt || a.createdAt));
        setItems(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading catalog news:", error);
        toast.error("No se pudieron cargar las novedades.");
        setLoading(false);
      },
    );
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    getDocs(query(collection(db, "catalogNews"), where("branchId", "==", branchId)))
      .then((snap) => setLegacy(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((n) => n.imageUrl)))
      .catch(() => setLegacy([]));
  }, [branchId]);

  useEffect(() => () => photo?.preview && URL.revokeObjectURL(photo.preview), [photo]);

  const pickPhoto = (fileList) => {
    const file = Array.from(fileList || []).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setPhoto({ file, preview: URL.createObjectURL(file) });
    nameInputRef.current?.focus();
  };

  // Pasting a screenshot anywhere on the page picks it as the photo
  useEffect(() => {
    const onPaste = (e) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) pickPhoto(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const register = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!branchId || !photo || !trimmed) {
      toast.error("Agrega una foto y el nombre del producto.");
      return;
    }
    setSaving(true);
    try {
      const { url, path } = await uploadToStorage(photo.file, `catalog-news/${branchId}`);
      await addDoc(collection(db, "products"), newsProductData({ name: trimmed, imageUrl: url, storagePath: path, branchId }));
      setName("");
      setPhoto(null);
      toast.success(`«${trimmed}» publicado en Novedades.`);
    } catch (error) {
      console.error("Error registering news product:", error);
      toast.error("No se pudo registrar la novedad.");
    } finally {
      setSaving(false);
    }
  };

  const update = async (item, data) => {
    try {
      await updateDoc(doc(db, "products", item.id), data);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la novedad.");
    }
  };

  const saveName = (item, value) => {
    if (!value || value === item.name) return;
    update(item, { name: value });
  };

  // Products created here with no stock are deleted; real products just leave Novedades
  const removeItem = async (item) => {
    const deletes = item.createdFromNews && !(Number(item.currentStock) > 0);
    const message = deletes
      ? `¿Eliminar «${item.name}»?`
      : `¿Quitar «${item.name}» de Novedades? El producto sigue en el inventario.`;
    if (!window.confirm(message)) return;
    try {
      if (deletes) {
        await deleteDoc(doc(db, "products", item.id));
        if (item.newsStoragePath) await deleteObject(ref(storage, item.newsStoragePath)).catch(() => {});
      } else {
        await updateDoc(doc(db, "products", item.id), { newsStatus: deleteField(), newsHidden: deleteField() });
      }
      toast.success(deletes ? "Novedad eliminada." : "Quitado de Novedades.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo quitar la novedad.");
    }
  };

  // One-off move of the old photo-only gallery into news products
  const migrateLegacy = async () => {
    setMigrating(true);
    let moved = 0;
    for (const n of legacy) {
      try {
        await addDoc(collection(db, "products"), {
          ...newsProductData({
            name: (n.caption || "").trim() || "Novedad",
            imageUrl: n.imageUrl,
            storagePath: n.storagePath,
            branchId,
            newsStatus: n.available ? NEWS_AVAILABLE : NEWS_COMING,
          }),
          newsHidden: n.visible === false,
        });
        await deleteDoc(doc(db, "catalogNews", n.id));
        moved += 1;
      } catch (error) {
        console.error("Error moving news photo:", error);
      }
    }
    // Drop the copy an earlier version mirrored onto the company doc
    await updateDoc(doc(db, "branches", branchId), { catalogNews: deleteField() }).catch(() => {});
    setLegacy((prev) => prev.slice(moved));
    setMigrating(false);
    if (moved) toast.success(`${moved} foto${moved === 1 ? "" : "s"} pasada${moved === 1 ? "" : "s"} a Novedades. Revisa sus nombres.`);
    if (moved < legacy.length) toast.error("Algunas fotos no se pudieron pasar.");
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Novedades del catálogo
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                Próximos ingresos de {currentBranch?.name || "la empresa"} · se registran como productos y se muestran (foto y nombre) en la pestaña «Novedades» del catálogo
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
          <div className="max-w-screen-xl mx-auto space-y-6">
            {legacy.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-5 py-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Tienes {legacy.length} foto{legacy.length === 1 ? "" : "s"} de la versión anterior de Novedades que el catálogo no muestra.
                </p>
                <button
                  onClick={migrateLegacy}
                  disabled={migrating}
                  className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-60"
                >
                  {migrating ? "Pasando…" : "Pasarlas a productos"}
                </button>
              </div>
            )}

            {/* Register form */}
            <form
              onSubmit={register}
              className="flex flex-col sm:flex-row gap-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4"
            >
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickPhoto(e.dataTransfer.files); }}
                onClick={() => !saving && fileInputRef.current?.click()}
                className={`relative shrink-0 w-full sm:w-40 aspect-[4/5] rounded-xl border-2 border-dashed overflow-hidden cursor-pointer flex items-center justify-center text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-slate-300 dark:border-slate-700 hover:border-primary/60"
                }`}
              >
                {photo ? (
                  <>
                    <img src={photo.preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPhoto(null); }}
                      title="Quitar foto"
                      className="absolute top-2 right-2 size-7 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <div className="px-3">
                    <UploadCloud size={28} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Foto</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Arrastra, pega (Ctrl+V) o haz clic</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { pickPhoto(e.target.files); e.target.value = ""; }}
              />
              <div className="flex-1 flex flex-col justify-end gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Nombre del producto</span>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Porcelanato mármol blanco 60x60"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-primary"
                  />
                </label>
                <p className="text-xs text-slate-400">
                  Se registra como producto sin stock. Cuando llegue, complétalo (precio, stock) desde el inventario y márcalo como «Ya disponible».
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  <ImagePlus size={16} />
                  {saving ? "Registrando…" : "Registrar novedad"}
                </button>
              </div>
            </form>

            {/* Gallery */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-12">
                Aún no hay novedades. Mientras no haya ninguna, el catálogo muestra un aviso de «Pronto».
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => {
                  const hidden = Boolean(item.newsHidden);
                  const available = item.newsStatus === NEWS_AVAILABLE;
                  return (
                    <div
                      key={item.id}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-opacity ${hidden ? "opacity-50" : ""}`}
                    >
                      <div className="relative aspect-[4/5] bg-slate-100 dark:bg-slate-800">
                        {(item.mainImageUrl || item.imageUrl) && (
                          <img src={item.mainImageUrl || item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <button
                            onClick={() => update(item, { newsStatus: available ? NEWS_COMING : NEWS_AVAILABLE })}
                            title={available ? "Volver a «Próximamente»" : "Marcar como «Ya disponible»"}
                            className={`size-8 rounded-full flex items-center justify-center shadow ${
                              available ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/90 text-emerald-600 hover:bg-white"
                            }`}
                          >
                            <PackageCheck size={15} />
                          </button>
                          <button
                            onClick={() => update(item, { newsHidden: !hidden })}
                            title={hidden ? "Mostrar en el catálogo" : "Ocultar del catálogo"}
                            className="size-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow hover:bg-white"
                          >
                            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button
                            onClick={() => removeItem(item)}
                            title="Quitar de Novedades"
                            className="size-8 rounded-full bg-white/90 text-rose-600 flex items-center justify-center shadow hover:bg-white"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="absolute bottom-2 left-2 flex gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-white text-[10px] font-bold uppercase tracking-wider ${
                              available ? "bg-emerald-500" : "bg-slate-900/70"
                            }`}
                          >
                            {available ? "Ya disponible" : "Próximamente"}
                          </span>
                          {hidden && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[10px] font-bold uppercase tracking-wider">
                              Oculta
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        defaultValue={item.name || ""}
                        onBlur={(e) => saveName(item, e.target.value.trim())}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        placeholder="Nombre del producto"
                        className="w-full px-3 py-2.5 text-xs font-semibold bg-transparent text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none border-t border-slate-100 dark:border-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800/50"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CatalogNews;
