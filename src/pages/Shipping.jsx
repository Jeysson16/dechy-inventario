import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  BellRing,
  FileStack,
  PackagePlus,
  ShipWheel,
  Timer,
  Warehouse,
} from "lucide-react";
import toast from "react-hot-toast";

import ShipmentDetail from "../components/shipping/ShipmentDetail";
import ShipmentList from "../components/shipping/ShipmentList";
import ConfirmModal from "../components/shipping/ConfirmModal";
import MapView from "../components/shipping/MapView";
import AppLayout from "../components/layout/AppLayout";
import { db, storage } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import {
  NOTIFICATION_THRESHOLDS,
  formatDateLabel,
  getDateValue,
  getShipmentProgress,
  getShipmentSnapshot,
  getShipmentStatus,
} from "../utils/shipping";

const initialForm = {
  id_contenedor: "",
  fecha_salida: new Date().toISOString().split("T")[0],
  dias_estimados: 45,
  origen: "China",
  destino: "Trujillo, Perú",
};

const getFilePathSafeName = (name = "documento") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const uploadShipmentDocuments = async (shipmentId, files) => {
  if (!files?.length) return [];

  const uploads = files.map(async (file) => {
    const path = `shipping-documents/${shipmentId}/${Date.now()}_${getFilePathSafeName(file.name)}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return {
      name: file.name,
      url,
      type: file.type || "application/octet-stream",
      size: file.size,
      path,
      uploadedAt: new Date().toISOString(),
    };
  });

  return Promise.all(uploads);
};

const KpiCard = ({ icon, label, value, hint, tone }) => (
  <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
          {label}
        </p>
        <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      </div>
      <div
        className={`flex size-14 items-center justify-center rounded-3xl ${tone}`}
      >
        {icon}
      </div>
    </div>
  </div>
);

const Shipping = () => {
  const { isAdmin } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [registrationFiles, setRegistrationFiles] = useState([]);
  const [detailPendingFiles, setDetailPendingFiles] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  const [editingShipmentId, setEditingShipmentId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const notificationGuardRef = useRef(new Set());

  useEffect(() => {
    const shipmentsQuery = query(
      collection(db, "envios"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      shipmentsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((shipmentDoc) => ({
          id: shipmentDoc.id,
          ...shipmentDoc.data(),
        }));
        setShipments(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading shipments:", error);
        toast.error("No se pudieron cargar los pedidos.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const shipmentSnapshots = useMemo(() => {
    return shipments.map(getShipmentSnapshot).sort((left, right) => {
      const leftDate =
        getDateValue(left.createdAt) ||
        getDateValue(left.fecha_salida) ||
        new Date(0);
      const rightDate =
        getDateValue(right.createdAt) ||
        getDateValue(right.fecha_salida) ||
        new Date(0);
      return rightDate.getTime() - leftDate.getTime();
    });
  }, [shipments]);

  useEffect(() => {
    if (!shipmentSnapshots.length) {
      setSelectedShipmentId(null);
      return;
    }

    const exists = shipmentSnapshots.some(
      (shipment) => shipment.id === selectedShipmentId,
    );
    if (!selectedShipmentId || !exists) {
      setSelectedShipmentId(shipmentSnapshots[0].id);
    }
  }, [shipmentSnapshots, selectedShipmentId]);

  const selectedShipment = useMemo(
    () =>
      shipmentSnapshots.find(
        (shipment) => shipment.id === selectedShipmentId,
      ) || null,
    [shipmentSnapshots, selectedShipmentId],
  );

  const metrics = useMemo(() => {
    const active = shipmentSnapshots.filter(
      (shipment) => shipment.estadoCalculado !== "Entregado",
    );
    const avgDays = shipmentSnapshots.length
      ? shipmentSnapshots.reduce(
          (sum, shipment) => sum + shipment.elapsedDays,
          0,
        ) / shipmentSnapshots.length
      : 0;

    return {
      inTransit: shipmentSnapshots.filter(
        (shipment) => shipment.estadoCalculado === "En tránsito",
      ).length,
      customs: shipmentSnapshots.filter(
        (shipment) => shipment.estadoCalculado === "Aduanas",
      ).length,
      delivered: shipmentSnapshots.filter(
        (shipment) => shipment.estadoCalculado === "Entregado",
      ).length,
      avgDays: avgDays.toFixed(1),
      activeCount: active.length,
    };
  }, [shipmentSnapshots]);

  useEffect(() => {
    if (!isAdmin || !shipmentSnapshots.length) return;

    const emitNotifications = async () => {
      for (const shipment of shipmentSnapshots) {
        const flags = shipment.notificationFlags || {};

        for (const threshold of NOTIFICATION_THRESHOLDS) {
          const key = `${shipment.id}-${threshold}`;
          if (
            notificationGuardRef.current.has(key) ||
            flags[String(threshold)]
          ) {
            continue;
          }

          const thresholdMet =
            threshold === 0
              ? shipment.progresoCalculado >= 100 ||
                (shipment.daysRemaining ?? 999) <= 0
              : shipment.daysRemaining === threshold;

          if (!thresholdMet) continue;

          notificationGuardRef.current.add(key);

          try {
            const body =
              threshold === 0
                ? `El contenedor ${shipment.id_contenedor} alcanzó su arribo estimado a Trujillo.`
                : `El contenedor ${shipment.id_contenedor} está próximo a llegar (${threshold} días restantes).`;

            await addDoc(collection(db, "notifications"), {
              title:
                threshold === 0
                  ? "Contenedor entregado"
                  : "Contenedor próximo a llegar",
              body,
              createdAt: new Date(),
              targetUserId: null,
              readBy: [],
              data: {
                shipmentId: shipment.id,
                threshold,
                type: "shipping-alert",
              },
            });

            await updateDoc(doc(db, "envios", shipment.id), {
              [`notificationFlags.${threshold}`]: true,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            console.error("Error sending shipment notification:", error);
            notificationGuardRef.current.delete(key);
          }
        }
      }
    };

    emitNotifications();
  }, [isAdmin, shipmentSnapshots]);

  const handleRegisterShipment = async (event) => {
    event.preventDefault();
    if (!isAdmin) {
      toast.error("Solo administradores pueden crear pedidos.");
      return;
    }

    const containerId = form.id_contenedor.trim().toUpperCase();
    if (!containerId) {
      toast.error("Ingresa el ID del contenedor.");
      return;
    }

    if (!form.fecha_salida) {
      toast.error("Selecciona la fecha de salida.");
      return;
    }

    setSaving(true);
    try {
      const progress = getShipmentProgress(
        form.fecha_salida,
        form.dias_estimados,
      );
      const status = getShipmentStatus(progress);
      const shipmentRef = await addDoc(collection(db, "envios"), {
        id_contenedor: containerId,
        fecha_salida: form.fecha_salida,
        dias_estimados: Number(form.dias_estimados) || 45,
        origen: form.origen,
        destino: form.destino,
        progreso: Math.round(progress),
        estado: status,
        documentos: [],
        productosTemporales: [],
        notificationFlags: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (registrationFiles.length) {
        const documents = await uploadShipmentDocuments(
          shipmentRef.id,
          registrationFiles,
        );
        await updateDoc(shipmentRef, { documentos: documents });
      }

      setForm(initialForm);
      setRegistrationFiles([]);
      setSelectedShipmentId(shipmentRef.id);
      toast.success("Pedido internacional registrado.");
    } catch (error) {
      console.error("Error creating shipment:", error);
      toast.error("No se pudo registrar el pedido.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocuments = async (files) => {
    if (!selectedShipment || !files?.length) return;

    setUploadingDocuments(true);
    try {
      const newDocuments = await uploadShipmentDocuments(
        selectedShipment.id,
        files,
      );
      await updateDoc(doc(db, "envios", selectedShipment.id), {
        documentos: [...(selectedShipment.documentos || []), ...newDocuments],
        updatedAt: serverTimestamp(),
      });
      setDetailPendingFiles([]);
      toast.success("Documentos subidos correctamente.");
    } catch (error) {
      console.error("Error uploading shipment documents:", error);
      toast.error("No se pudieron subir los documentos.");
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleEditShipment = async (updates) => {
    if (!selectedShipment) return;

    setSaving(true);
    try {
      const progress = getShipmentProgress(
        updates.fecha_salida || selectedShipment.fecha_salida,
        updates.dias_estimados || selectedShipment.dias_estimados,
      );
      const status = getShipmentStatus(progress);

      await updateDoc(doc(db, "envios", selectedShipment.id), {
        ...updates,
        progreso: Math.round(progress),
        estado: status,
        updatedAt: serverTimestamp(),
      });

      setEditingShipmentId(null);
      toast.success("Pedido actualizado correctamente.");
    } catch (error) {
      console.error("Error updating shipment:", error);
      toast.error("No se pudo actualizar el pedido.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShipment = (shipmentId) => {
    setDeleteTargetId(shipmentId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    setSaving(true);
    try {
      // Delete Firestore document
      await deleteDoc(doc(db, "envios", deleteTargetId));

      // If deleted shipment was selected, select the first available
      if (selectedShipmentId === deleteTargetId) {
        const remaining = shipmentSnapshots.filter(
          (s) => s.id !== deleteTargetId,
        );
        setSelectedShipmentId(remaining[0]?.id || null);
      }

      toast.success("Pedido eliminado correctamente.");
      setDeleteModalOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error("Error deleting shipment:", error);
      toast.error("No se pudo eliminar el pedido.");
    } finally {
      setSaving(false);
    }
  };

  const generateTestShipments = async () => {
    if (!isAdmin) {
      toast.error("Solo administradores pueden crear datos de prueba.");
      return;
    }

    setSaving(true);
    try {
      const containerIds = [
        "CONT001",
        "CONT002",
        "CONT003",
        "CONT004",
        "CONT005",
      ];
      const testData = [];

      for (const containerId of containerIds) {
        const daysAgo = Math.floor(Math.random() * 40) + 5; // Random 5-45 days ago
        const diasEstimados = Math.floor(Math.random() * 20) + 40; // Random 40-60 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        const fechaSalida = startDate.toISOString().split("T")[0];

        const progress = getShipmentProgress(fechaSalida, diasEstimados);
        const status = getShipmentStatus(progress);

        const shipmentRef = await addDoc(collection(db, "envios"), {
          id_contenedor: containerId,
          fecha_salida: fechaSalida,
          dias_estimados: diasEstimados,
          origen: "Changan, China",
          destino: "Trujillo, Perú",
          progreso: Math.round(progress),
          estado: status,
          documentos: [],
          productosTemporales: [],
          notificationFlags: {},
          createdAt: startDate,
          updatedAt: startDate,
        });

        testData.push(shipmentRef.id);
      }

      toast.success(
        `${testData.length} pedidos de prueba creados correctamente.`,
      );
    } catch (error) {
      console.error("Error generating test shipments:", error);
      toast.error("No se pudieron crear los pedidos de prueba.");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="min-h-full bg-slate-50 px-4 py-10 dark:bg-slate-950 md:px-8">
          <div className="mx-auto max-w-3xl rounded-[36px] border border-rose-200 bg-white p-10 text-center shadow-sm dark:border-rose-900/40 dark:bg-slate-900">
            <BellRing className="mx-auto h-10 w-10 text-rose-500" />
            <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
              Acceso restringido
            </h1>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              Este módulo de pedidos internacionales solo está disponible para
              usuarios con rol admin.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-full bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.9))] p-7 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.16),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.94))]">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-300">
                  <ShipWheel className="h-4 w-4" />
                  Simulación logística internacional
                </div>
                <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  Gestión de pedidos en contenedores desde Changan hasta
                  Trujillo con trazabilidad por fechas.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Registra pedidos, estima tiempos de arribo, simula múltiples
                  rutas curvas en paralelo y centraliza documentos logísticos en
                  un solo módulo protegido para administración.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                    {metrics.activeCount} pedidos activos
                  </div>
                  <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                    Último pedido:{" "}
                    {shipmentSnapshots[0]
                      ? formatDateLabel(shipmentSnapshots[0].fecha_salida)
                      : "Sin registros"}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleRegisterShipment}
                className="rounded-[30px] border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                      Registro de pedido
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                      Nuevo contenedor
                    </h2>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                    <PackagePlus className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      ID contenedor
                    </label>
                    <input
                      value={form.id_contenedor}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          id_contenedor: event.target.value,
                        }))
                      }
                      placeholder="Ej: CONT-CH-TRU-001"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Fecha salida
                    </label>
                    <input
                      type="date"
                      value={form.fecha_salida}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          fecha_salida: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Días estimados
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.dias_estimados}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          dias_estimados: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Origen
                    </label>
                    <input
                      value={form.origen}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          origen: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Destino
                    </label>
                    <input
                      value={form.destino}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          destino: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                        Documentos iniciales
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        PDF, Excel o Word para embarque, packing list y soporte
                        aduanero.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white dark:bg-white dark:text-slate-900">
                      <FileStack className="h-4 w-4" />
                      Adjuntar
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                        className="hidden"
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          if (!files.length) return;
                          setRegistrationFiles((prev) => [...prev, ...files]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {!!registrationFiles.length && (
                    <div className="mt-4 space-y-2">
                      {registrationFiles.map((file) => (
                        <div
                          key={`${file.name}-${file.lastModified}`}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white disabled:opacity-50"
                >
                  <Warehouse className="h-4 w-4" />
                  {saving ? "Registrando..." : "Registrar pedido"}
                </button>

                <button
                  type="button"
                  onClick={generateTestShipments}
                  disabled={saving}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <PackagePlus className="h-4 w-4" />
                  {saving ? "Generando..." : "Generar datos de prueba"}
                </button>
              </form>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-4">
            <KpiCard
              icon={<ShipWheel className="h-6 w-6" />}
              label="En tránsito"
              value={metrics.inTransit}
              hint="Contenedores cruzando la ruta marítima"
              tone="bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300"
            />
            <KpiCard
              icon={<BellRing className="h-6 w-6" />}
              label="En aduanas"
              value={metrics.customs}
              hint="En revisión y liberación documental"
              tone="bg-violet-100 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300"
            />
            <KpiCard
              icon={<Warehouse className="h-6 w-6" />}
              label="Entregados"
              value={metrics.delivered}
              hint="Arribos culminados a destino final"
              tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300"
            />
            <KpiCard
              icon={<Timer className="h-6 w-6" />}
              label="Tiempo promedio"
              value={`${metrics.avgDays} d`}
              hint="Promedio transcurrido entre todos los pedidos"
              tone="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </section>

          <MapView
            shipments={shipmentSnapshots}
            selectedShipmentId={selectedShipmentId}
          />

          <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <ShipmentList
              shipments={shipmentSnapshots}
              selectedShipmentId={selectedShipmentId}
              onSelectShipment={(shipment) => {
                setSelectedShipmentId(shipment.id);
                setDetailPendingFiles([]);
              }}
            />
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80">
                <div className="size-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (
              <ShipmentDetail
                shipment={selectedShipment}
                pendingFiles={detailPendingFiles}
                onPendingFilesChange={setDetailPendingFiles}
                onUploadDocuments={handleUploadDocuments}
                onEdit={() =>
                  setEditingShipmentId((prev) =>
                    prev === selectedShipment.id ? null : selectedShipment.id,
                  )
                }
                onDelete={() => handleDeleteShipment(selectedShipment.id)}
                isEditing={editingShipmentId === selectedShipment?.id}
                onSaveEdit={handleEditShipment}
                savingEdit={saving}
                uploadingDocuments={uploadingDocuments}
              />
            )}
          </section>
        </div>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Eliminar pedido"
        description="¿Estás seguro de que deseas eliminar este pedido y todos sus documentos? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isLoading={saving}
        isDangerous={true}
        onConfirm={handleConfirmDelete}
      />
    </AppLayout>
  );
};

export default Shipping;
