import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ShopCartProvider, useShopCart } from "./context/ShopCartContext";
import { ShopAuthProvider } from "./context/ShopAuthContext";
import { useVisibleProducts } from "./hooks/useVisibleProducts";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CartSidebar from "./components/CartSidebar";
import ShopAuthModal from "./components/ShopAuthModal";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import CalculadoraPage from "./pages/CalculadoraPage";
import ShopRegisterPage from "./pages/ShopRegisterPage";
import "./shop.css";

const ShopLayout = () => {
  const { products, categories, loading, normalize } = useVisibleProducts();
  const cart = useShopCart();
  const [cartOpen, setCartOpen] = useState(false);

  const onAddToCart = (product) => {
    cart.addItem(product, 1);
    setCartOpen(true);
  };

  return (
    <div className="shop-theme">
      <Navbar
        cartCount={cart.totals.itemCount}
        products={products}
        categories={categories}
        onCartOpen={() => setCartOpen(true)}
      />

      <main>
        <Routes>
          <Route
            index
            element={
              <HomePage
                products={products}
                categories={categories}
                onAddToCart={onAddToCart}
              />
            }
          />
          <Route
            path="catalogo"
            element={
              <div className="shop-shell py-6">
                <CatalogPage
                  products={products}
                  categories={categories}
                  loading={loading}
                  normalize={normalize}
                  onAddToCart={onAddToCart}
                />
              </div>
            }
          />
          <Route
            path="producto/:productId"
            element={
              <ProductDetailPage
                products={products}
                onAddToCart={onAddToCart}
              />
            }
          />
          <Route
            path="carrito"
            element={
              <div className="shop-shell py-6">
                <CartPage cart={cart} />
              </div>
            }
          />
          <Route
            path="checkout"
            element={
              <div className="shop-shell py-6">
                <CheckoutPage cart={cart} />
              </div>
            }
          />
          <Route
            path="calculadora"
            element={
              <div className="shop-shell py-6">
                <CalculadoraPage />
              </div>
            }
          />
          <Route path="registro" element={<ShopRegisterPage />} />
          <Route path="*" element={<Navigate to="/tienda" replace />} />
        </Routes>
      </main>

      <Footer />

      {/* Floating overlays */}
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} />
      <ShopAuthModal />
    </div>
  );
};

const ShopRoutes = () => (
  <ShopAuthProvider>
    <ShopCartProvider>
      <ShopLayout />
    </ShopCartProvider>
  </ShopAuthProvider>
);

export default ShopRoutes;
