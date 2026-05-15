/**
 * CartSidebar — floating right-side cart panel.
 * Slides in from the right when cart icon is clicked.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
  ArrowRight,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useShopCart } from "../context/ShopCartContext";
import { useShopAuth } from "../context/ShopAuthContext";

const CartSidebar = ({ open, onClose }) => {
  const { items, totals, updateItemQty, removeItem } = useShopCart();
  const { requireAuth } = useShopAuth();
  const navigate = useNavigate();

  const handleCheckout = () => {
    requireAuth(() => {
      onClose();
      navigate("/tienda/checkout");
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="shop-cart-overlay"
          />

          {/* Sidebar panel */}
          <motion.div
            key="sidebar"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="shop-cart-sidebar"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-slate-700" />
                <h2 className="font-black text-slate-900 text-base">
                  Mi Carrito
                </h2>
                {totals.itemCount > 0 && (
                  <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full">
                    {totals.itemCount}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <Package size={28} className="text-slate-400" />
                  </div>
                  <p className="font-bold text-slate-700 text-sm">
                    Tu carrito está vacío
                  </p>
                  <p className="text-xs text-slate-400">
                    Agrega productos para continuar
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      navigate("/tienda/catalogo");
                    }}
                    className="mt-2 text-sm font-bold text-[#CFAE70] hover:underline flex items-center gap-1"
                  >
                    Ver catálogo <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                items.map((item) => {
                  const useWholesale =
                    Number(item.wholesalePrice) > 0 &&
                    Number(item.wholesaleThreshold) > 0 &&
                    item.quantity >= Number(item.wholesaleThreshold);
                  const unitPrice = useWholesale
                    ? Number(item.wholesalePrice)
                    : item.price;
                  const lineTotal = unitPrice * item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Image */}
                      <div className="size-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={20} className="text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">
                          {item.name}
                        </p>
                        {useWholesale && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            Precio mayorista
                          </p>
                        )}
                        <p className="text-sm font-black text-[#CFAE70] mt-1">
                          S/ {lineTotal.toFixed(2)}
                        </p>

                        {/* Qty controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() =>
                              updateItemQty(item.id, item.quantity - 1)
                            }
                            className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold text-slate-900 w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateItemQty(item.id, item.quantity + 1)
                            }
                            className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="ml-auto size-6 rounded-md flex items-center justify-center text-rose-400 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: subtotal + checkout */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50/60">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="font-black text-slate-900">
                    S/ {totals.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    {totals.itemCount} producto
                    {totals.itemCount !== 1 ? "s" : ""}
                  </span>
                  <span>+ costo de envío</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-slate-900 transition-all hover:opacity-90"
                  style={{ background: "#CFAE70" }}
                >
                  Proceder al pago <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigate("/tienda/catalogo");
                  }}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200"
                >
                  Seguir comprando
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartSidebar;
