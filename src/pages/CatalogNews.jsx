import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Sparkles, Trash2, Eye, EyeOff, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db, storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

// Photos of upcoming arrivals shown in the public catalog's "Novedades" tab.
// Each company keeps its own gallery (branchId), like every other catalog record.
const COLLECTION = "catalogNews";

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

const CatalogNews = () => {
  const { currentBranch, currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null); // { done, total }
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const branchId = currentBranch?.id;

  useEffect(() => {
    if (!branchId) return undefined;
    setLoading(true);
    const q = query(collection(db, COLLECTION), where("branchId", "==", branchId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
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

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!branchId || files.length === 0) return;
    setUploading({ done: 0, total: files.length });
    let failed = 0;
    for (const file of files) {
      try {
        const { url, path } = await uploadToStorage(file, `catalog-news/${branchId}`);
        await addDoc(collection(db, COLLECTION), {
          branchId,
          imageUrl: url,
          storagePath: path,
          caption: "",
          visible: true,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid || null,
        });
      } catch (error) {
        console.error("Error uploading news photo:", error);
        failed += 1;
      }
      setUploading((prev) => prev && { ...prev, done: prev.done + 1 });
    }
    setUploading(null);
    if (failed) toast.error(`${failed} foto${failed === 1 ? "" : "s"} no se pudo subir.`);
    else toast.success(`${files.length} foto${files.length === 1 ? "" : "s"} publicada${files.length === 1 ? "" : "s"} en Novedades.`);
  };

  // Pasting a screenshot anywhere on the page uploads it
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) uploadFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const saveCaption = async (item, caption) => {
    if ((item.caption || "") === caption) return;
    try {
      await updateDoc(doc(db, COLLECTION, item.id), { caption });
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar la descripción.");
    }
  };

  const toggleVisible = async (item) => {
    try {
      await updateDoc(doc(db, COLLECTION, item.id), { visible: item.visible === false });
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la foto.");
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm("¿Eliminar esta foto de Novedades?")) return;
    try {
      await deleteDoc(doc(db, COLLECTION, item.id));
      if (item.storagePath) await deleteObject(ref(storage, item.storagePath)).catch(() => {});
      toast.success("Foto eliminada.");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar la foto.");
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Novedades del catálogo
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                  Fotos de los próximos ingresos de {currentBranch?.name || "la empresa"} · se muestran en la pestaña «Novedades» del catálogo
                </p>
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={Boolean(uploading)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              <ImagePlus size={16} />
              Subir fotos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6">
          <div className="max-w-screen-xl mx-auto space-y-6">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary/60"
              }`}
            >
              <UploadCloud size={32} className="mx-auto text-slate-400 mb-2" />
              {uploading ? (
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Subiendo {uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1} de {uploading.total}…
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Arrastra fotos aquí, pégalas con Ctrl+V o haz clic para elegirlas
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Puedes subir varias a la vez</p>
                </>
              )}
            </div>

            {/* Gallery */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-12">
                Aún no hay fotos de próximos ingresos. Mientras no haya ninguna, el catálogo muestra un aviso de «Pronto».
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => {
                  const hidden = item.visible === false;
                  return (
                    <div
                      key={item.id}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-opacity ${hidden ? "opacity-50" : ""}`}
                    >
                      <div className="relative aspect-[4/5] bg-slate-100 dark:bg-slate-800">
                        <img src={item.imageUrl} alt={item.caption || "Novedad"} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <button
                            onClick={() => toggleVisible(item)}
                            title={hidden ? "Mostrar en el catálogo" : "Ocultar del catálogo"}
                            className="size-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow hover:bg-white"
                          >
                            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button
                            onClick={() => removeItem(item)}
                            title="Eliminar"
                            className="size-8 rounded-full bg-white/90 text-rose-600 flex items-center justify-center shadow hover:bg-white"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {hidden && (
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[10px] font-bold uppercase tracking-wider">
                            Oculta
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        defaultValue={item.caption || ""}
                        onBlur={(e) => saveCaption(item, e.target.value.trim())}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        placeholder="Descripción (opcional)"
                        className="w-full px-3 py-2.5 text-xs bg-transparent text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none border-t border-slate-100 dark:border-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800/50"
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
