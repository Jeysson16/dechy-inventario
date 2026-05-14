import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import Button from "../components/Button";

const CartPage = ({ cart }) => {
  const { items, totals, updateItemQty, removeItem } = cart;

  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-black text-slate-100">
          Tu carrito esta vacio
        </h1>
        <p className="mt-2 text-slate-400">
          Agrega productos para continuar con tu compra.
        </p>
        <Link to="/tienda/catalogo" className="mt-5 inline-block">
          <Button>Ir al catalogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="shop-card flex gap-4 rounded-2xl p-4"
          >
            <img
              src={
                item.imageUrl || "https://placehold.co/120x120?text=Producto"
              }
              alt={item.name}
              className="h-24 w-24 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold text-slate-100">
                {item.name}
              </h3>
              <p className="text-sm text-slate-400">
                S/ {Number(item.price || 0).toFixed(2)} c/u
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateItemQty(item.id, item.quantity - 1)}
                  className="rounded-lg border border-slate-600 p-1 text-slate-300"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-8 text-center text-sm font-semibold text-slate-100">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateItemQty(item.id, item.quantity + 1)}
                  className="rounded-lg border border-slate-600 p-1 text-slate-300"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="h-max rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-300"
              aria-label="Eliminar"
            >
              <Trash2 size={18} />
            </button>
          </article>
        ))}
      </section>

      <aside className="shop-card h-max rounded-2xl p-5">
        <h2 className="text-xl font-black text-slate-100">Resumen</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p className="flex justify-between">
            <span>Productos</span>
            <span>{totals.itemCount}</span>
          </p>
          <p className="flex justify-between text-base font-bold text-slate-100">
            <span>Total</span>
            <span>S/ {totals.subtotal.toFixed(2)}</span>
          </p>
        </div>

        <Link to="/tienda/checkout" className="mt-4 block">
          <Button className="w-full">Ir a checkout</Button>
        </Link>
      </aside>
    </div>
  );
};

export default CartPage;
