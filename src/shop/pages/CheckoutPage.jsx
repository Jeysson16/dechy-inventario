import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import Input from "../components/Input";
import Button from "../components/Button";

const initialForm = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  city: "Trujillo",
  notes: "",
  paymentMethod: "Yape",
};

const CheckoutPage = ({ cart }) => {
  const navigate = useNavigate();
  const { items, totals, clearCart } = cart;

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const createOrder = async () => {
    if (!items.length) {
      setError("Tu carrito esta vacio.");
      return;
    }

    if (!form.fullName || !form.phone || !form.address) {
      setError("Completa nombre, telefono y direccion.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const orderRef = await addDoc(collection(db, "shopOrders"), {
        customer: {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
        },
        notes: form.notes,
        paymentMethod: form.paymentMethod,
        items,
        totals,
        status: "pending",
        timeline: [
          {
            key: "confirmado",
            label: "Pedido confirmado",
            at: new Date().toISOString(),
          },
        ],
        createdAt: serverTimestamp(),
      });

      clearCart();
      navigate(`/tienda/tracking?order=${orderRef.id}`);
    } catch (err) {
      setError(err?.message || "No se pudo completar la compra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <article className="shop-card rounded-2xl p-5">
          <h1 className="text-2xl font-black text-slate-100">Checkout</h1>
          <p className="mt-1 text-sm text-slate-400">
            Completa tus datos para finalizar el pedido.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nombre completo"
              value={form.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
            />
            <Input
              placeholder="Telefono"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
            <Input
              placeholder="Correo (opcional)"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            <Input
              placeholder="Ciudad"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
            />
          </div>

          <Input
            className="mt-3"
            placeholder="Direccion de entrega"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />

          <textarea
            className="mt-3 min-h-24 w-full rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-[#CFAE70]"
            placeholder="Referencia o notas"
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
          />
        </article>

        <article className="shop-card rounded-2xl p-5">
          <h2 className="text-lg font-black text-slate-100">Metodo de pago</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {["Yape", "Transferencia", "Efectivo"].map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => handleChange("paymentMethod", method)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  form.paymentMethod === method
                    ? "border-[#CFAE70] bg-[#CFAE70]/15 text-[#CFAE70]"
                    : "border-slate-600 bg-slate-900/60 text-slate-200"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </article>
      </section>

      <aside className="shop-card h-max rounded-2xl p-5">
        <h2 className="text-xl font-black text-slate-100">Resumen de compra</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          {items.map((item) => (
            <p key={item.id} className="flex justify-between gap-2">
              <span className="line-clamp-1">
                {item.name} x{item.quantity}
              </span>
              <span>
                S/ {(Number(item.price || 0) * item.quantity).toFixed(2)}
              </span>
            </p>
          ))}
          <hr className="border-slate-700" />
          <p className="flex justify-between text-base font-bold text-slate-100">
            <span>Total</span>
            <span>S/ {totals.subtotal.toFixed(2)}</span>
          </p>
        </div>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        <Button
          className="mt-4 w-full"
          onClick={createOrder}
          disabled={loading}
        >
          {loading ? "Procesando..." : "Confirmar pedido"}
        </Button>
      </aside>
    </div>
  );
};

export default CheckoutPage;
