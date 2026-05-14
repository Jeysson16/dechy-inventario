import { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "shop_cart_v1";

const readInitialCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ShopCartContext = createContext(null);

export const useShopCart = () => {
  const context = useContext(ShopCartContext);
  if (!context) {
    throw new Error("useShopCart debe usarse dentro de ShopCartProvider");
  }
  return context;
};

export const ShopCartProvider = ({ children }) => {
  const [items, setItems] = useState(readInitialCart);

  const persist = (nextItems) => {
    setItems(nextItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  };

  const addItem = (product, qty = 1) => {
    const safeQty = Math.max(Number(qty) || 1, 1);
    const existing = items.find((item) => item.id === product.id);
    if (existing) {
      const next = items.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + safeQty }
          : item,
      );
      persist(next);
      return;
    }

    const next = [
      ...items,
      {
        id: product.id,
        name: product.name,
        price: Number(product.unitPrice || product.price || 0),
        wholesalePrice: Number(product.wholesalePrice || 0),
        wholesaleThreshold: Number(product.wholesaleThreshold || 0),
        imageUrl: product.imageUrl || "",
        quantity: safeQty,
      },
    ];
    persist(next);
  };

  const updateItemQty = (id, qty) => {
    const safeQty = Number(qty) || 0;
    if (safeQty <= 0) {
      removeItem(id);
      return;
    }
    persist(
      items.map((item) =>
        item.id === id ? { ...item, quantity: safeQty } : item,
      ),
    );
  };

  const removeItem = (id) => {
    persist(items.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    persist([]);
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const useWholesale =
        Number(item.wholesalePrice) > 0 &&
        Number(item.wholesaleThreshold) > 0 &&
        item.quantity >= Number(item.wholesaleThreshold);
      const unit = useWholesale ? Number(item.wholesalePrice) : item.price;
      return acc + unit * item.quantity;
    }, 0);
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

    return {
      subtotal,
      itemCount,
    };
  }, [items]);

  return (
    <ShopCartContext.Provider
      value={{ items, totals, addItem, updateItemQty, removeItem, clearCart }}
    >
      {children}
    </ShopCartContext.Provider>
  );
};
