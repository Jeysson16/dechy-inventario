import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  QrCode,
  Share2,
  ShoppingBag,
  Package,
  X,
  Download,
  CheckCircle2,
  Minus,
  Plus,
  Truck,
  ShieldCheck,
  Heart,
} from "lucide-react";
import ProductCard from "../components/ProductCard";
import { calculateAvailableUnits, toProductImage } from "../utils/stock";
import { generateProductQR, getProductPublicUrl } from "../../utils/productUtils";

const WHATSAPP_NUMBER = "51919066888";

const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogg"];
const isVideoUrl = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTS.some((ext) => lower.includes(ext));
};

const getImages = (product) => {
  const seen = new Set();
  const result = [];

  const push = (url, mediaType) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push({ url, mediaType });
  };

  if (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0) {
    product.imageUrls.forEach((i) => {
      if (typeof i === "string") {
        push(i, isVideoUrl(i) ? "video" : "image");
      } else if (i?.url) {
        push(i.url, i.mediaType || (isVideoUrl(i.url) ? "video" : "image"));
      }
    });
  }

  if (result.length === 0) {
    const main = product?.mainImageUrl || product?.imageUrl;
    if (main) push(main, isVideoUrl(main) ? "video" : "image");
  }

  return result;
};

const ProductDetailPage = ({ products, onAddToCart }) => {
  const { productId } = useParams();
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const product = useMemo(
    () =>
      products.find((item) => item.slug === productId) ||
      products.find((item) => String(item.id) === String(productId)),
    [products, productId],
  );

  const images = useMemo(() => getImages(product), [product]);

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter((item) => item.id !== product.id && item.category === product.category)
      .slice(0, 4);
  }, [products, product]);

  useEffect(() => {
    if (!product?.id) return;
    setQrDataUrl(null);
    generateProductQR(product.slug, product.id, { dark: "#0F172A", light: "#FFFFFF", width: 256 })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [product?.id, product?.slug]);

  /* Reset qty on product change */
  useEffect(() => { setQty(1); setActiveImg(0); }, [productId]);

  if (!product) {
    return (
      <div className="shop-shell py-24 text-center space-y-4">
        <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
          <Package size={28} className="text-slate-400" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Producto no encontrado</h1>
        <p className="text-slate-500">El producto que buscas no existe o fue eliminado.</p>
        <Link
          to="/tienda/catalogo"
          className="inline-flex items-center gap-2 text-[#CFAE70] hover:underline font-semibold"
        >
          <ChevronLeft size={16} /> Volver al catálogo
        </Link>
      </div>
    );
  }

  const available = calculateAvailableUnits(product);
  const hasStock = available > 0;
  const price = Number(product?.unitPrice || product?.price || 0);
  const isOnSale = product?.isOnSale && product?.salePrice > 0;
  const salePrice = Number(product?.salePrice || 0);
  const discount = product?.discountPercent || 0;
  const publicUrl = getProductPublicUrl(product.slug, product.id);
  const displayPrice = isOnSale ? salePrice : price;

  const whatsappMsg = encodeURIComponent(
    `Hola Jieda! Me interesa el producto:\n*${product.name}*\nSKU: ${product.sku || "—"}\nPrecio: S/ ${displayPrice.toFixed(2)}\n\n${publicUrl}`,
  );

  const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) onAddToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2200);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url: publicUrl }); } catch {}
    } else {
      navigator.clipboard?.writeText(publicUrl);
    }
  };

  return (
    <div className="shop-shell py-8 shop-page-enter">
      {/* Breadcrumb */}
      <nav className="shop-breadcrumb mb-8">
        <Link to="/tienda">Inicio</Link>
        <ChevronRight size={12} />
        <Link to="/tienda/catalogo">Catálogo</Link>
        {product.category && (
          <>
            <ChevronRight size={12} />
            <Link to={`/tienda/catalogo?cat=${encodeURIComponent(product.category)}`}>
              {product.category}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="current truncate max-w-[180px]">{product.name}</span>
      </nav>

      {/* ── Main product layout ── */}
      <div className="grid lg:grid-cols-[72px_1fr_1fr] gap-6 mb-16">
        {/* Thumbnails column (desktop: vertical left) */}
        {images.length > 1 && (
          <div className="hidden lg:flex flex-col gap-2 pt-1">
            {images.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImg(idx)}
                className={`flex-shrink-0 size-[68px] rounded-lg overflow-hidden border-2 transition-all ${
                  idx === activeImg
                    ? "border-slate-900"
                    : "border-slate-200 opacity-60 hover:opacity-100"
                }`}
              >
                {item.mediaType === "video" ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover pointer-events-none"
                    muted
                    playsInline
                  />
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div className={images.length <= 1 ? "lg:col-span-1" : ""}>
          {/* Main image with zoom */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 aspect-square group cursor-zoom-in">
            {images[activeImg]?.mediaType === "video" ? (
              <video
                key={images[activeImg]?.url}
                src={images[activeImg]?.url}
                className="w-full h-full object-cover"
                controls
                playsInline
                autoPlay
                muted
                loop
              />
            ) : (
              <img
                src={images[activeImg]?.url || toProductImage(product)}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            )}
            {isOnSale && discount > 0 && (
              <div className="absolute top-4 left-4 bg-slate-900 text-white font-black text-sm px-3 py-1.5 rounded-full shadow">
                {discount}% OFF
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-700 hover:bg-white shadow transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-700 hover:bg-white shadow transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails row (mobile: below image) */}
          {images.length > 1 && (
            <div className="lg:hidden flex gap-2 mt-3 overflow-x-auto pb-1">
              {images.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImg(idx)}
                  className={`flex-shrink-0 size-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === activeImg ? "border-slate-900" : "border-slate-200 opacity-60"
                  }`}
                >
                  {item.mediaType === "video" ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover pointer-events-none"
                      muted
                      playsInline
                    />
                  ) : (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info panel ── */}
        <div className="space-y-5">
          {/* Brand */}
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Jieda</p>

          {/* Product name */}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
            {product.name}
          </h1>

          {/* Price */}
          <div>
            {isOnSale ? (
              <>
                <p className="text-sm text-slate-400 line-through">
                  S/ {price.toFixed(2)} Un
                </p>
                <p className="text-3xl font-black text-slate-900 leading-none mt-0.5">
                  S/ {salePrice.toFixed(2)} Un
                </p>
              </>
            ) : (
              <p className="text-3xl font-black text-slate-900">
                S/ {price.toFixed(2)} Un
              </p>
            )}
          </div>

          {/* Stock + SKU */}
          <div className="space-y-1">
            <p className={`text-sm font-bold ${hasStock ? "text-emerald-600" : "text-red-500"}`}>
              {hasStock ? `EN STOCK (${available} disponibles)` : "SIN STOCK"}
            </p>
            {product.sku && (
              <p className="text-xs text-slate-400">
                SKU#: <span className="font-mono">{product.sku}</span>
              </p>
            )}
          </div>

          <hr className="border-slate-200" />

          {/* Qty selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Cantidad
            </p>
            <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="w-12 text-center text-sm font-bold text-slate-900">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(available || 999, q + 1))}
                disabled={!hasStock}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={!hasStock}
            className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-black text-sm tracking-wider transition-all ${
              addedToCart
                ? "bg-emerald-600 text-white"
                : hasStock
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {addedToCart ? <CheckCircle2 size={18} /> : <ShoppingBag size={18} />}
            {addedToCart ? "¡AGREGADO AL CARRITO!" : "COMPRAR"}
          </button>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
          >
            <MessageCircle size={17} /> Cotizar por WhatsApp
          </a>

          {/* Favorites + share */}
          <div className="flex items-center justify-center gap-6">
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-500 transition-colors">
              <Heart size={16} /> Agregar a Favoritos
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Share2 size={16} /> Compartir
            </button>
          </div>

          {/* Info notice */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 leading-relaxed">
            Este producto está sujeto a disponibilidad de stock. Te mantendremos informado sobre cualquier cambio en el despacho.
          </div>

          {/* Specs */}
          {(product.dimensions || product.length || product.unitsPerBox || product.description) && (
            <div className="space-y-3 pt-1">
              <hr className="border-slate-200" />
              {product.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {(product.dimensions || (product.length && product.width)) && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Medidas</p>
                    <p className="text-sm font-bold text-slate-800">
                      {product.dimensions || `${product.length}×${product.width}${product.height ? `×${product.height}` : ""} cm`}
                    </p>
                  </div>
                )}
                {product.unitsPerBox && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Rendimiento</p>
                    <p className="text-sm font-bold text-slate-800">{product.unitsPerBox} u/caja</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QR button */}
          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            <QrCode size={13} /> Ver código QR del producto
          </button>

          {/* Trust row */}
          <div className="flex gap-4 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Truck size={14} className="text-[#CFAE70]" /> Envío a todo el país
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck size={14} className="text-[#CFAE70]" /> Calidad garantizada
            </div>
          </div>
        </div>
      </div>

      {/* ── Related products ── */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-5 text-xl font-black text-slate-900">Productos relacionados</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} onAddToCart={onAddToCart} />
            ))}
          </div>
        </section>
      )}

      {/* ── QR Modal ── */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-3 right-3 size-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
            <div>
              <p className="font-black text-slate-900 text-base">{product.name}</p>
              <p className="text-slate-400 text-xs mt-0.5">Escanea para ver la ficha del producto</p>
            </div>
            {qrDataUrl ? (
              <div className="flex justify-center">
                <div className="p-3 bg-white border border-slate-200 rounded-2xl inline-block shadow-sm">
                  <img src={qrDataUrl} alt="QR" className="size-48" />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-10">
                <div className="size-8 border-2 border-[#CFAE70] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <p className="text-[10px] text-slate-400 font-mono break-all">{publicUrl}</p>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`qr-${product.sku || product.id}.png`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors"
              >
                <Download size={15} /> Descargar QR
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
