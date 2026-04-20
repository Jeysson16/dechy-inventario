import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import toast from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import CustomerMap from "../components/customers/CustomerMap";
import { db, storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const defaultForm = {
  customerName: "",
  customerDNI: "",
  phone: "",
  address: "",
  lat: null,
  lng: null,
};

const Customers = () => {
  const { currentBranch } = useAuth();

  // ── Data ──
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Table search ──
  const [searchTerm, setSearchTerm] = useState("");

  // ── Explorer panel (right side) ──
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerSelected, setExplorerSelected] = useState(null);

  // ── Map fly-to control ──
  const [flyTarget, setFlyTarget] = useState(null);

  // ── Modal ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Firestore subscription ──
  useEffect(() => {
    if (!currentBranch?.id) return;
    const q = query(
      collection(db, "customers"),
      where("branchId", "==", currentBranch.id),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
        data.sort(
          (a, b) =>
            (Number(b.totalSalesCount) || 0) - (Number(a.totalSalesCount) || 0),
        );
        setCustomers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading customers:", error);
        toast.error("No se pudo cargar clientes.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [currentBranch?.id]);

  // ── Derived counts ──
  const mappedCount = useMemo(
    () =>
      customers.filter(
        (c) => typeof c.lat === "number" && typeof c.lng === "number",
      ).length,
    [customers],
  );

  // ── Table filter ──
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        (c.customerName || "").toLowerCase().includes(term) ||
        (c.customerDNI || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term),
    );
  }, [customers, searchTerm]);

  // ── Explorer search results ──
  const explorerResults = useMemo(() => {
    const term = explorerSearch.toLowerCase().trim();
    if (!term) return [];
    return customers
      .filter(
        (c) =>
          (c.customerName || "").toLowerCase().includes(term) ||
          (c.customerDNI || "").toLowerCase().includes(term) ||
          (c.phone || "").toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [customers, explorerSearch]);

  // ── Modal helpers ──
  const openCreateModal = () => {
    setEditingCustomer(null);
    setForm(defaultForm);
    setPhotoFile(null);
    setPhotoPreview(null);
    setGeoLoading(false);
    setIsModalOpen(true);
  };

  const closeCustomerModal = () => {
    setIsModalOpen(false);
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setForm({
      customerName: customer.customerName || "",
      customerDNI: customer.customerDNI || "",
      phone: customer.phone || "",
      address: customer.address || "",
      lat: customer.lat || null,
      lng: customer.lng || null,
    });
    setPhotoFile(null);
    setPhotoPreview(customer.localPhotoUrl || null);
    setGeoLoading(false);
    setIsModalOpen(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5 MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("La cámara no está disponible en este navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("No se pudo acceder a la cámara. Verifica los permisos.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("No se pudo capturar la imagen.");
          return;
        }
        const file = new File([blob], `customer_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  const handleGetGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no disponible en tu navegador.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        toast.success(
          `Ubicación obtenida: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`,
        );
        setGeoLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("No se pudo obtener la ubicación. Verifica los permisos.");
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const customerName = form.customerName.trim();
    if (!customerName) {
      toast.error("Ingrese el nombre del cliente.");
      return;
    }
    setSaving(true);
    try {
      const basePayload = {
        customerName,
        customerDNI: form.customerDNI.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        lat: form.lat || null,
        lng: form.lng || null,
        branchId: currentBranch?.id || null,
        updatedAt: serverTimestamp(),
      };

      if (editingCustomer) {
        let localPhotoUrl = editingCustomer.localPhotoUrl || null;
        if (photoFile) {
          const sRef = storageRef(
            storage,
            `customers/${editingCustomer.id}/photo_${Date.now()}.jpg`,
          );
          await uploadBytes(sRef, photoFile);
          localPhotoUrl = await getDownloadURL(sRef);
        }
        await updateDoc(doc(db, "customers", editingCustomer.id), {
          ...basePayload,
          localPhotoUrl,
        });
        toast.success("Cliente actualizado.");
      } else {
        const docRef = await addDoc(collection(db, "customers"), {
          ...basePayload,
          createdAt: serverTimestamp(),
          totalSalesCount: 0,
          totalSalesAmount: 0,
          creditSalesCount: 0,
          lastSaleAt: null,
          localPhotoUrl: null,
          lat: form.lat || null,
          lng: form.lng || null,
        });
        if (photoFile) {
          const sRef = storageRef(
            storage,
            `customers/${docRef.id}/photo_${Date.now()}.jpg`,
          );
          await uploadBytes(sRef, photoFile);
          const localPhotoUrl = await getDownloadURL(sRef);
          await updateDoc(docRef, { localPhotoUrl });
        }
        toast.success("Cliente creado.");
      }

      closeCustomerModal();
      setEditingCustomer(null);
      setForm(defaultForm);
      setPhotoFile(null);
      setPhotoPreview(null);
      setGeoLoading(false);
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`¿Eliminar cliente "${customer.customerName}"?`))
      return;
    try {
      await deleteDoc(doc(db, "customers", customer.id));
      toast.success("Cliente eliminado.");
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("No se pudo eliminar el cliente.");
    }
  };

  const handleFlyTo = (customer) => {
    if (typeof customer.lat !== "number" || typeof customer.lng !== "number") {
      toast("Este cliente no tiene ubicación registrada.", { icon: "📍" });
      return;
    }
    setFlyTarget({ lat: customer.lat, lng: customer.lng, key: Date.now() });
    setExplorerSelected(customer);
  };

  // ── Avatar helper ──
  const CustomerAvatar = ({ customer, size = "size-10" }) =>
    customer.localPhotoUrl ? (
      <img
        src={customer.localPhotoUrl}
        alt={customer.customerName}
        className={`${size} rounded-xl object-cover flex-shrink-0 border border-slate-100 dark:border-slate-700`}
      />
    ) : (
      <div
        className={`${size} rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0`}
      >
        <span className="text-sm font-black text-primary">
          {(customer.customerName || "?")[0].toUpperCase()}
        </span>
      </div>
    );

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* ── Header ── */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6">
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                CLIENTES
              </p>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                Gestión de Clientes
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {customers.length} clientes ·{" "}
                <span className="text-emerald-500 font-bold">
                  {mappedCount} ubicados
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-6 py-3 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">
                person_add
              </span>
              Nuevo Cliente
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-screen-xl mx-auto space-y-6">
            {/* ── Map + Explorer row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-[460px]">
              {/* Map card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      MAPA DE CLIENTES
                    </p>
                    <p className="text-base font-black text-slate-800 dark:text-white">
                      Ubicaciones registradas en Perú
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {mappedCount} ubicaciones
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <CustomerMap
                    customers={customers}
                    flyToCustomer={flyTarget}
                    onCustomerClick={(c) => setExplorerSelected(c)}
                  />
                </div>
              </div>

              {/* Explorer panel */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3 overflow-hidden">
                <div className="flex-shrink-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    EXPLORADOR
                  </p>
                  <p className="text-base font-black text-slate-800 dark:text-white">
                    Buscar y enfocar clientes
                  </p>
                </div>

                {/* Explorer search */}
                <div className="relative flex-shrink-0">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    value={explorerSearch}
                    onChange={(e) => setExplorerSearch(e.target.value)}
                    placeholder="Buscar por nombre, DNI/RUC, teléfono..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Explorer search results */}
                {explorerSearch && explorerResults.length > 0 && (
                  <div className="flex-shrink-0 space-y-0.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                    {explorerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          handleFlyTo(c);
                          setExplorerSearch("");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white dark:hover:bg-slate-700 text-left transition-colors"
                      >
                        <CustomerAvatar customer={c} size="size-8" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                            {c.customerName}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {c.customerDNI || "Sin DNI"}
                          </p>
                        </div>
                        {typeof c.lat === "number" && (
                          <span className="material-symbols-outlined text-sm text-emerald-500 flex-shrink-0">
                            location_on
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {explorerSearch && explorerResults.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2 flex-shrink-0">
                    Sin resultados
                  </p>
                )}

                {/* Selected customer card */}
                {explorerSelected ? (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
                      {explorerSelected.localPhotoUrl ? (
                        <img
                          src={explorerSelected.localPhotoUrl}
                          alt={explorerSelected.customerName}
                          className="w-full h-44 object-cover"
                        />
                      ) : (
                        <div className="w-full h-44 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-5xl text-primary/30">
                            person
                          </span>
                        </div>
                      )}
                      <div className="p-4">
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {explorerSelected.customerName}
                        </p>
                        {explorerSelected.customerDNI && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            DNI/RUC: {explorerSelected.customerDNI}
                          </p>
                        )}
                        {explorerSelected.address && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Dirección: {explorerSelected.address}
                          </p>
                        )}
                        {typeof explorerSelected.lat === "number" && (
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">
                            Coordenadas: {explorerSelected.lat.toFixed(6)},{" "}
                            {explorerSelected.lng.toFixed(6)}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleFlyTo(explorerSelected)}
                          className="mt-3 w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">
                            my_location
                          </span>
                          Centrar en mapa
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-4 text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-30">
                      travel_explore
                    </span>
                    <p className="text-xs font-medium">
                      Busca un cliente o haz clic en un marcador del mapa
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Customer table ── */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-700 dark:text-white">
                  Todos los clientes ({filteredCustomers.length})
                </p>
                <div className="relative max-w-xs w-full sm:w-auto">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar clientes..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                    progress_activity
                  </span>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block opacity-30">
                    group
                  </span>
                  No hay clientes registrados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Cliente
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          DNI/RUC
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Ubicación
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Ventas
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Monto
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCustomers.map((customer) => {
                        const hasLocation =
                          typeof customer.lat === "number" &&
                          typeof customer.lng === "number";
                        return (
                          <tr
                            key={customer.id}
                            onMouseEnter={() => setExplorerSelected(customer)}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <CustomerAvatar customer={customer} />
                                <div>
                                  <p className="font-black text-slate-900 dark:text-white">
                                    {customer.customerName || "Cliente"}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {customer.phone || "Sin teléfono"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                              {customer.customerDNI || "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              {hasLocation ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
                                  <span className="size-1.5 bg-emerald-500 rounded-full" />
                                  Registrada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                  <span className="size-1.5 bg-slate-400 rounded-full" />
                                  Sin ubicación
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                              {Number(customer.totalSalesCount || 0)}
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-primary">
                              S/{" "}
                              {Number(customer.totalSalesAmount || 0).toFixed(
                                2,
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleFlyTo(customer)}
                                  title="Ver en mapa"
                                  disabled={!hasLocation}
                                  className={`size-9 rounded-xl flex items-center justify-center transition-colors ${
                                    hasLocation
                                      ? "text-primary hover:bg-primary/10"
                                      : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-base">
                                    map
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(customer)}
                                  className="size-9 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-100/70 dark:hover:bg-amber-900/20 flex items-center justify-center transition-colors"
                                >
                                  <span className="material-symbols-outlined text-base">
                                    edit
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomer(customer)}
                                  className="size-9 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-100/70 dark:hover:bg-rose-900/20 flex items-center justify-center transition-colors"
                                >
                                  <span className="material-symbols-outlined text-base">
                                    delete
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Create / Edit modal ── */}
        {isModalOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={closeCustomerModal}
          >
            <div
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSaveCustomer}>
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                  </h3>
                </div>

                <div className="p-6 space-y-4 max-h-[62vh] overflow-y-auto">
                  {/* Photo upload */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                      Foto del cliente
                    </label>
                    <div className="flex items-center gap-4">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="size-20 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                        />
                      ) : (
                        <div className="size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-3xl text-slate-400">
                            person
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-bold cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={startCamera}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">
                            photo_camera
                          </span>
                          Tomar foto
                        </button>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Máx. 5 MB · JPG, PNG, WebP
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customerName: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                      DNI / RUC
                    </label>
                    <input
                      type="text"
                      value={form.customerDNI}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          customerDNI: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  {/* Geolocation Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                        Coordenadas
                      </label>
                      <button
                        type="button"
                        onClick={handleGetGeolocation}
                        disabled={geoLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {geoLoading ? (
                          <>
                            <div className="size-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            Localizando...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">
                              my_location
                            </span>
                            Usar mi ubicación
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Latitud
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={form.lat ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".").trim();
                            setForm((prev) => ({
                              ...prev,
                              lat: raw === "" ? null : Number(raw),
                            }));
                          }}
                          placeholder="Ej: -12.0464"
                          className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                          Longitud
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={form.lng ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".").trim();
                            setForm((prev) => ({
                              ...prev,
                              lng: raw === "" ? null : Number(raw),
                            }));
                          }}
                          placeholder="Ej: -77.0428"
                          className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCustomerModal}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isCameraOpen && (
          <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
              <div className="relative aspect-[4/3] bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="p-8 flex items-center justify-center gap-12 bg-slate-900 border-t border-slate-800">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="size-14 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                >
                  <span className="material-symbols-outlined text-3xl">
                    close
                  </span>
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="size-20 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/20 relative group"
                >
                  <div className="size-16 rounded-full border-2 border-slate-900 group-active:bg-slate-200 transition-colors" />
                </button>
                <div className="size-14" />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Customers;
