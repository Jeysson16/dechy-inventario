import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { getSunatConfigStatus, saveSunatConfig } from "../services/sunatApi";
import { isValidRuc } from "../utils/sunat";

const EMPTY_CONFIG = {
  ruc: "", razonSocial: "", direccion: "", ubigeo: "", establishmentCode: "0000",
  facturaSeries: "F001", boletaSeries: "B001", environment: "beta",
};

const EMPTY_CREDENTIALS = { usuarioSol: "", claveSol: "", pfxPassword: "", pfxBase64: "" };

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("No se pudo leer el certificado."));
    reader.readAsDataURL(file);
  });
}

const SunatConfig = () => {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(EMPTY_CONFIG);
  const [credentials, setCredentials] = useState(EMPTY_CREDENTIALS);
  const [certificateName, setCertificateName] = useState("");
  const [status, setStatus] = useState(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await getSunatConfigStatus();
      setStatus(data);
      setFormData({ ...EMPTY_CONFIG, ...(data.publicConfig || {}) });
    } catch (error) {
      console.error("Error loading SUNAT config:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const normalized = ["ruc", "ubigeo", "establishmentCode", "environment"].includes(name)
      ? value
      : value.toUpperCase();
    setFormData((current) => ({ ...current, [name]: normalized }));
  };

  const handleCredentialChange = (event) => {
    const { name, value } = event.target;
    setCredentials((current) => ({ ...current, [name]: name === "usuarioSol" ? value.toUpperCase() : value }));
  };

  const handleCertificate = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.pfx$|\.p12$/i.test(file.name)) return toast.error("Seleccione un certificado .pfx o .p12.");
    try {
      const pfxBase64 = await readFileAsBase64(file);
      setCredentials((current) => ({ ...current, pfxBase64 }));
      setCertificateName(file.name);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValidRuc(formData.ruc)) return toast.error("El RUC del emisor no es válido.");
    if (!/^\d{6}$/.test(formData.ubigeo)) return toast.error("El ubigeo debe tener 6 dígitos.");
    if (!/^F[A-Z0-9]{3}$/.test(formData.facturaSeries)) return toast.error("La serie de factura debe iniciar con F.");
    if (!/^B[A-Z0-9]{3}$/.test(formData.boletaSeries)) return toast.error("La serie de boleta debe iniciar con B.");

    setLoading(true);
    try {
      const suppliedCredentials = Object.fromEntries(
        Object.entries(credentials).filter(([, value]) => String(value || "").length > 0),
      );
      const data = await saveSunatConfig({ ...formData, credentials: suppliedCredentials });
      setStatus(data);
      setCredentials(EMPTY_CREDENTIALS);
      setCertificateName("");
      toast.success("Configuración fiscal y credenciales seguras guardadas.");
    } catch (error) {
      console.error("Error saving SUNAT config:", error);
      toast.error(error.message, { duration: 7000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto text-slate-900 dark:text-white">
        <h1 className="text-2xl font-black mb-2">Configuración SUNAT</h1>
        <p className="text-sm text-slate-500 mb-6">
          Los datos fiscales se administran desde Firebase. Usuario SOL, clave y certificado se envían al backend y se guardan cifrados; nunca se vuelven a mostrar en el navegador.
        </p>

        {status?.legacySecretsDetected && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Se detectaron credenciales antiguas sin aislar. Al guardar, el backend las migrará al documento privado cifrado y eliminará los campos públicos.
          </div>
        )}
        {status && !status.encryptionReady && (
          <div className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
            Falta <code>SUNAT_CONFIG_ENCRYPTION_KEY</code> en el backend. No se permitirá guardar secretos hasta configurarla.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <section className="space-y-4">
            <h2 className="font-black text-lg">Datos del emisor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-bold">RUC de la empresa
                <input name="ruc" inputMode="numeric" maxLength={11} value={formData.ruc} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
              <label className="text-sm font-bold">Razón social
                <input name="razonSocial" value={formData.razonSocial} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
            </div>
            <label className="text-sm font-bold block">Dirección fiscal
              <input name="direccion" value={formData.direccion} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="text-sm font-bold">Ubigeo
                <input name="ubigeo" inputMode="numeric" maxLength={6} value={formData.ubigeo} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
              <label className="text-sm font-bold">Establecimiento
                <input name="establishmentCode" maxLength={4} value={formData.establishmentCode} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
              <label className="text-sm font-bold">Serie factura
                <input name="facturaSeries" maxLength={4} value={formData.facturaSeries} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
              <label className="text-sm font-bold">Serie boleta
                <input name="boletaSeries" maxLength={4} value={formData.boletaSeries} onChange={handleChange} required className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
            <div>
              <h2 className="font-black text-lg">Credenciales privadas</h2>
              <p className="text-xs text-slate-500">Deje un campo vacío para conservar el valor cifrado existente.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-bold">Usuario SOL
                <input name="usuarioSol" autoComplete="off" value={credentials.usuarioSol} onChange={handleCredentialChange} placeholder={status?.usuarioSolConfigured ? "Configurado — no se muestra" : "Usuario secundario SOL"} className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
              <label className="text-sm font-bold">Clave SOL
                <input name="claveSol" type="password" autoComplete="new-password" value={credentials.claveSol} onChange={handleCredentialChange} placeholder={status?.claveSolConfigured ? "Configurada — no se muestra" : "Clave SOL"} className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
              <label className="text-sm font-bold">Certificado digital (.pfx/.p12)
                <input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={handleCertificate} className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
                <span className="mt-1 block text-xs text-slate-500">{certificateName || (status?.certificateConfigured ? "Certificado configurado" : "Sin certificado")}</span>
              </label>
              <label className="text-sm font-bold">Contraseña del PFX
                <input name="pfxPassword" type="password" autoComplete="new-password" value={credentials.pfxPassword} onChange={handleCredentialChange} placeholder={status?.certificatePasswordConfigured ? "Configurada — no se muestra" : "Opcional si el PFX no tiene clave"} className="mt-2 block w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-900">
            <label className="font-bold">Ambiente habilitado
              <select name="environment" value={formData.environment} onChange={handleChange} className="ml-3 rounded-lg border border-sky-300 bg-white px-3 py-2">
                <option value="beta">SUNAT Beta — pruebas</option>
                <option value="production" disabled={!status?.productionEnabled}>SUNAT Producción {!status?.productionEnabled ? "— bloqueado" : ""}</option>
              </select>
            </label>
            <p className="mt-2">En beta se autentica con MODDATOS; el PFX sigue siendo necesario para probar la firma. Producción exige además Usuario y Clave SOL y la habilitación explícita del servidor.</p>
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={loading || status?.encryptionReady === false} className="bg-primary text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50">
              {loading ? "Procesando..." : "Guardar en Firebase de forma segura"}
            </button>
            <button type="button" onClick={loadStatus} disabled={loading} className="border border-slate-300 px-5 py-3 rounded-xl font-bold disabled:opacity-50">Verificar conexión</button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default SunatConfig;
