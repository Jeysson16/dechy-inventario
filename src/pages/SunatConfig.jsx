import React, { useEffect, useState } from "react";
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { isValidRuc } from "../utils/sunat";

const EMPTY_CONFIG = {
  ruc: "",
  razonSocial: "",
  direccion: "",
  ubigeo: "",
  establishmentCode: "0000",
  facturaSeries: "F001",
  boletaSeries: "B001",
};

const SunatConfig = () => {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(EMPTY_CONFIG);
  const [legacySecretsDetected, setLegacySecretsDetected] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const snapshot = await getDoc(doc(db, "settings", "sunat"));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setLegacySecretsDetected(Boolean(data.usuarioSol || data.claveSol || data.cdtBase64));
          setFormData({
            ...EMPTY_CONFIG,
            ruc: data.ruc || "",
            razonSocial: data.razonSocial || "",
            direccion: data.direccion || "",
            ubigeo: data.ubigeo || "",
            establishmentCode: data.establishmentCode || "0000",
            facturaSeries: data.facturaSeries || "F001",
            boletaSeries: data.boletaSeries || "B001",
          });
        }
      } catch (error) {
        console.error("Error loading SUNAT config:", error);
        toast.error("No se pudo cargar la configuración SUNAT.");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value.toUpperCase() }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValidRuc(formData.ruc)) return toast.error("El RUC del emisor no es válido.");
    if (!/^\d{6}$/.test(formData.ubigeo)) return toast.error("El ubigeo debe tener 6 dígitos.");
    if (!/^F[A-Z0-9]{3}$/.test(formData.facturaSeries)) return toast.error("La serie de factura debe iniciar con F.");
    if (!/^B[A-Z0-9]{3}$/.test(formData.boletaSeries)) return toast.error("La serie de boleta debe iniciar con B.");

    setLoading(true);
    try {
      await setDoc(
        doc(db, "settings", "sunat"),
        {
          ...formData,
          usuarioSol: deleteField(),
          claveSol: deleteField(),
          cdtBase64: deleteField(),
          updatedAt: new Date(),
        },
        { merge: true },
      );
      setLegacySecretsDetected(false);
      toast.success("Configuración fiscal pública guardada.");
    } catch (error) {
      console.error("Error saving SUNAT config:", error);
      toast.error("No se pudo guardar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto text-slate-900 dark:text-white">
        <h1 className="text-2xl font-black mb-2">Configuración SUNAT</h1>
        <p className="text-sm text-slate-500 mb-6">
          Aquí solo se guardan datos públicos del emisor. La Clave SOL y el certificado deben permanecer en secretos del backend.
        </p>

        {legacySecretsDetected && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Se detectaron credenciales antiguas en Firestore. Al guardar esta pantalla se eliminarán Clave SOL, usuario SOL y certificado de la base de datos.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-bold">RUC del emisor
              <input aria-label="RUC del emisor" name="ruc" inputMode="numeric" maxLength={11} value={formData.ruc} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
            <label className="text-sm font-bold">Razón social
              <input aria-label="Razón social" name="razonSocial" value={formData.razonSocial} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
          </div>
          <label className="text-sm font-bold block">Dirección fiscal
            <input aria-label="Dirección fiscal" name="direccion" value={formData.direccion} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-bold">Ubigeo SUNAT
              <input aria-label="Ubigeo SUNAT" name="ubigeo" inputMode="numeric" maxLength={6} value={formData.ubigeo} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
            <label className="text-sm font-bold">Código de establecimiento
              <input aria-label="Código de establecimiento" name="establishmentCode" maxLength={4} value={formData.establishmentCode} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-bold">Serie de factura
              <input aria-label="Serie de factura" name="facturaSeries" maxLength={4} value={formData.facturaSeries} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
            <label className="text-sm font-bold">Serie de boleta
              <input aria-label="Serie de boleta" name="boletaSeries" maxLength={4} value={formData.boletaSeries} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
          </div>
          <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-900">
            Modo actual: <strong>prevalidación UBL 2.1</strong>. El envío real y la generación de CDR permanecen deshabilitados.
          </div>
          <button type="submit" disabled={loading} className="bg-primary text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50">
            {loading ? "Procesando..." : "Guardar configuración fiscal"}
          </button>
        </form>
      </div>
    </AppLayout>
  );
};

export default SunatConfig;
