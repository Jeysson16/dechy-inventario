import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { calculatePurchaseTotals, purchaseTaxEffect, validatePurchase } from "../utils/purchases";

const initialForm = () => ({
  supplierRuc: "", supplierName: "", documentType: "01", series: "", number: "",
  issueDate: new Date().toISOString().slice(0, 10), currency: "PEN", description: "",
  taxableBase: "", igv: "", nonTaxableAmount: "", otherTaxes: "",
});

export default function Purchases() {
  const { currentBranch, currentUser, userProfile } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [purchases, setPurchases] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentBranch?.id) return undefined;
    const purchasesQuery = query(collection(db, "purchases"), where("branchId", "==", currentBranch.id));
    return onSnapshot(purchasesQuery, (snapshot) => {
      const rows = [];
      snapshot.forEach((item) => rows.push({ id: item.id, ...item.data() }));
      rows.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setPurchases(rows);
    }, (error) => {
      console.error("Error loading purchases:", error);
      toast.error("No se pudo cargar el Registro de Compras.");
    });
  }, [currentBranch?.id]);

  const totals = useMemo(() => calculatePurchaseTotals(form), [form]);
  const monthTotals = useMemo(() => purchases.reduce((acc, item) => ({
    total: acc.total + Number(item.total || 0) * purchaseTaxEffect(item.documentType),
    igv: acc.igv + Number(item.igv || 0) * purchaseTaxEffect(item.documentType),
  }), { total: 0, igv: 0 }), [purchases]);

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: ["series", "supplierName"].includes(name) ? value.toUpperCase() : value }));
  };

  const taxableChange = (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, taxableBase: value, igv: value === "" ? "" : String(Math.round(Number(value) * 18) / 100) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = validatePurchase(form);
    if (errors.length) return toast.error(errors[0]);
    setSaving(true);
    try {
      await addDoc(collection(db, "purchases"), {
        ...form,
        ...totals,
        supplierRuc: form.supplierRuc.trim(),
        supplierName: form.supplierName.trim(),
        series: form.series.trim().toUpperCase(),
        number: form.number.trim(),
        description: form.description.trim(),
        branchId: currentBranch.id,
        branchName: currentBranch.name || "",
        status: "registered",
        sireStatus: "pending_review",
        taxEffect: purchaseTaxEffect(form.documentType),
        sunatTransmission: "not_applicable_billservice",
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        createdByName: userProfile?.name || currentUser.email,
      });
      setForm(initialForm());
      toast.success("Compra registrada para revisión tributaria/SIRE.");
    } catch (error) {
      console.error("Error saving purchase:", error);
      toast.error("No se pudo registrar la compra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 text-slate-900 dark:text-white">
        <div className="max-w-screen-xl mx-auto space-y-6">
          <div><p className="text-xs font-black uppercase tracking-widest text-primary">Control tributario</p><h1 className="text-3xl font-black">Registro de Compras</h1><p className="text-sm text-slate-500 mt-1">Registra los comprobantes recibidos de proveedores y sus impuestos.</p></div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Este registro no se envía por el servicio de emisión de comprobantes.</strong> La factura de compra la emite el proveedor; Dechy la registra para validar IGV/crédito fiscal y preparar el Registro de Compras/SIRE.
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-6">
            <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 h-fit">
              <h2 className="font-black text-lg">Nuevo comprobante recibido</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold">RUC proveedor<input name="supplierRuc" inputMode="numeric" maxLength={11} value={form.supplierRuc} onChange={change} required className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
                <label className="text-xs font-bold">Fecha emisión<input name="issueDate" type="date" value={form.issueDate} onChange={change} required className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
              </div>
              <label className="text-xs font-bold block">Razón social<input name="supplierName" value={form.supplierName} onChange={change} required className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-bold">Tipo<select name="documentType" value={form.documentType} onChange={change} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700"><option value="01">Factura 01</option><option value="03">Boleta 03</option><option value="07">Nota crédito 07</option><option value="08">Nota débito 08</option></select></label>
                <label className="text-xs font-bold">Serie<input name="series" maxLength={4} value={form.series} onChange={change} required className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
                <label className="text-xs font-bold">Número<input name="number" inputMode="numeric" maxLength={8} value={form.number} onChange={change} required className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
              </div>
              <label className="text-xs font-bold block">Detalle / productos<input name="description" value={form.description} onChange={change} placeholder="Mercadería, guía u observación" className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold">Base gravada<input name="taxableBase" type="number" min="0" step="0.01" value={form.taxableBase} onChange={taxableChange} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
                <label className="text-xs font-bold">IGV<input name="igv" type="number" min="0" step="0.01" value={form.igv} onChange={change} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
                <label className="text-xs font-bold">No gravado<input name="nonTaxableAmount" type="number" min="0" step="0.01" value={form.nonTaxableAmount} onChange={change} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
                <label className="text-xs font-bold">Otros tributos<input name="otherTaxes" type="number" min="0" step="0.01" value={form.otherTaxes} onChange={change} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-800 dark:border-slate-700" /></label>
              </div>
              <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-4 flex justify-between"><span className="font-bold">Total calculado</span><strong className="text-xl">S/ {totals.total.toFixed(2)}</strong></div>
              <button disabled={saving} className="w-full rounded-xl bg-primary text-white p-3 font-black disabled:opacity-50">{saving ? "Registrando…" : "Registrar compra"}</button>
            </form>

            <section className="space-y-4 min-w-0">
              <div className="grid grid-cols-2 gap-4"><div className="rounded-2xl bg-white dark:bg-slate-900 border p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500 font-black">Compras registradas</p><strong className="text-2xl">S/ {monthTotals.total.toFixed(2)}</strong></div><div className="rounded-2xl bg-white dark:bg-slate-900 border p-4 dark:border-slate-800"><p className="text-xs uppercase text-slate-500 font-black">IGV registrado</p><strong className="text-2xl">S/ {monthTotals.igv.toFixed(2)}</strong></div></div>
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500"><tr><th className="p-4">Proveedor</th><th className="p-4">Comprobante</th><th className="p-4">Fecha</th><th className="p-4 text-right">Base</th><th className="p-4 text-right">IGV</th><th className="p-4 text-right">Total</th><th className="p-4">SIRE</th></tr></thead><tbody className="divide-y dark:divide-slate-800">{purchases.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-slate-500">Aún no hay compras registradas.</td></tr> : purchases.map((item) => <tr key={item.id}><td className="p-4"><strong>{item.supplierName}</strong><div className="text-xs text-slate-500">{item.supplierRuc}</div></td><td className="p-4">{item.documentType} {item.series}-{item.number}</td><td className="p-4">{item.issueDate}</td><td className="p-4 text-right">S/ {Number(item.taxableBase).toFixed(2)}</td><td className="p-4 text-right">S/ {Number(item.igv).toFixed(2)}</td><td className="p-4 text-right font-black">S/ {Number(item.total).toFixed(2)}</td><td className="p-4"><span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold">Por revisar</span></td></tr>)}</tbody></table></div>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
