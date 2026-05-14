import { Routes, Route, Navigate } from "react-router-dom";
import { ShopCartProvider, useShopCart } from "./context/ShopCartContext";
import { useVisibleProducts } from "./hooks/useVisibleProducts";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import TrackingPage from "./pages/TrackingPage";
import CalculadoraPage from "./pages/CalculadoraPage";
import "./shop.css";

const ShopLayout = () => {
  const { products, categories, loading, normalize } = useVisibleProducts();
  const cart = useShopCart();

  const onAddToCart = (product) => {
    cart.addItem(product, 1);
  };

  return (
    <div className="shop-theme">
      <Navbar cartCount={cart.totals.itemCount} products={products} />
      <main className="shop-shell">
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
              <CatalogPage
                products={products}
                categories={categories}
                loading={loading}
                normalize={normalize}
                onAddToCart={onAddToCart}
              />
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
          <Route path="carrito" element={<CartPage cart={cart} />} />
          <Route path="checkout" element={<CheckoutPage cart={cart} />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="calculadora" element={<CalculadoraPage />} />
          <Route path="*" element={<Navigate to="/tienda" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const ShopRoutes = () => {
  return (
    <ShopCartProvider>
      <ShopLayout />
    </ShopCartProvider>
  );
};

export default ShopRoutes;
