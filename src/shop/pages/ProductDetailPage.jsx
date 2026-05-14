/**
 * ProductDetailPage — enhanced public product page.
 * Route: /tienda/producto/:productId  (supports both ID and slug)
 *
 * Features:
 *   • Image gallery with thumbnail navigation
 *   • Sale price / discount badge
 *   • Specs grid (dimensions, format, category)
 *   • Live QR code for product URL
 *   • WhatsApp inquiry button
 *   • Share product
 *   • Related products
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  QrCode,
  Share2,
  ShoppingBag,
  Star,
  Tag,
  Ruler,
  Package,
  X,
  Download,
} from "lucide-react";
import ProductCard from "../components/ProductCard";
import Button from "../components/Button";
import Badge from "../components/Badge";
import { calculateAvailableUnits, toProductImage } from "../utils/stock";
import {
  generateProductQR,
  getProductPublicUrl,
} from "../../utils/productUtils";

/* ── Helpers ── */
const getImages = (product) => {
  const rich =
    product?.imageUrls
      ?.map?.((i) => (typeof i === "string" ? i : i?.url))
      .filter(Boolean) || [];
  const main = product?.mainImageUrl || product?.imageUrl;
  const all = rich.length > 0 ? rich : main ? [main] : [];
  return [...new Set(all)];
};

const WHATSAPP_NUMBER = "51999999999"; // ← update to your actual number

const ProductDetailPage = ({ products, onAddToCart }) => {
  const { productId } = useParams();
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);

  /* Find by slug first, then by id */
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
      .filter(
        (item) => item.id !== product.id && item.category === product.category,
      )
      .slice(0, 4);
  }, [products, product]);

  /* Generate QR */
  useEffect(() => {
    if (!product?.id) return;
    setQrDataUrl(null);
    generateProductQR(product.slug, product.id, {
      dark: "#0F172A",
      light: "#FFFFFF",
      width: 256,
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [product?.id, product?.slug]);

  if (!product) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="size-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
          <Package size={28} className="text-slate-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-100">
          Producto no encontrado
        </h1>
        <p className="text-slate-400">
          El producto que buscas no existe o fue eliminado.
        </p>
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

  const whatsappMsg = encodeURIComponent(
    `Hola Dechy! Me interesa el producto:\n*${product.name}*\nSKU: ${product.sku || "—"}\nPrecio: S/ ${(isOnSale ? salePrice : price).toFixed(2)}\n\n${publicUrl}`,
  );

  const handleAddToCart = () => {
    onAddToCart(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          url: publicUrl,
          text: `${product.name} — S/ ${(isOnSale ? salePrice : price).toFixed(2)}`,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(publicUrl);
    }
  };

  return (
    <div className="space-y-14 py-8 shop-page-enter">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/tienda" className="hover:text-[#CFAE70]">
          Inicio
        </Link>
        <ChevronRight size={12} />
        <Link to="/tienda/catalogo" className="hover:text-[#CFAE70]">
          Catálogo
        </Link>
        {product.category && (
          <>
            <ChevronRight size={12} />
            <Link
              to={`/tienda/catalogo?cat=${encodeURIComponent(product.category)}`}
              className="hover:text-[#CFAE70]"
            >
              {product.category}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="text-slate-400 truncate max-w-[140px]">
          {product.name}
        </span>
      </nav>

      {/* Main grid */}
      <section className="grid gap-8 lg:grid-cols-2">
        {/* Left: Image gallery */}
        <div className="space-y-3">
          <div className="relative shop-card overflow-hidden rounded-3xl aspect-square">
            <img
              src={images[activeImg] || "/img/logojieda.png"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {/* Discount badge */}
            {isOnSale && discount > 0 && (
              <div className="absolute top-4 left-4 bg-rose-500 text-white font-black text-sm px-3 py-1.5 rounded-full shadow-lg">
                -{discount}% OFF
              </div>
            )}
            {/* Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActiveImg((i) => (i - 1 + images.length) % images.length)
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImg(idx)}
                  className={`flex-shrink-0 size-16 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === activeImg
                      ? "border-[#CFAE70]"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product info */}
        <div className="space-y-6">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={hasStock ? "success" : "warning"}>
              {hasStock ? `${available} disponibles` : "Sin stock"}
            </Badge>
            {product.category && <Badge>{product.category}</Badge>}
            {product.subcategory && <Badge>{product.subcategory}</Badge>}
            {isOnSale && (
              <span className="text-xs font-black px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                ¡EN OFERTA!
              </span>
            )}
          </div>

          {/* Name + SKU */}
          <div>
            <h1 className="text-3xl font-black text-slate-50 leading-tight">
              {product.name}
            </h1>
            {product.sku && (
              <p className="text-xs font-mono text-slate-500 mt-1">
                SKU: {product.sku}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4">
            {isOnSale ? (
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-slate-500 text-sm line-through">
                    S/ {price.toFixed(2)}
                  </p>
                  <p className="text-rose-400 font-black text-4xl leading-none">
                    S/ {salePrice.toFixed(2)}
                  </p>
                  <p className="text-rose-400/70 text-xs mt-1">
                    Precio especial de oferta
                  </p>
                </div>
                <div
                  className="ml-auto rounded-2xl px-4 py-2 font-black text-xl text-slate-900"
                  style={{ background: "#CFAE70" }}
                >
                  -{discount}%
                </div>
              </div>
            ) : (
              <p className="text-4xl font-black" style={{ color: "#CFAE70" }}>
                S/ {price.toFixed(2)}
              </p>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-slate-300 text-sm leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Specs grid */}
          {(product.length ||
            product.width ||
            product.unitsPerBox ||
            product.dimensions) && (
            <div className="grid grid-cols-2 gap-2">
              {(product.dimensions || (product.length && product.width)) && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-3 flex items-center gap-2">
                  <Ruler size={15} className="text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Medidas
                    </p>
                    <p className="text-slate-200 text-xs font-bold">
                      {product.dimensions ||
                        `${product.length}×${product.width}${product.height ? `×${product.height}` : ""} cm`}
                    </p>
                  </div>
                </div>
              )}
              {product.unitsPerBox && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-3 flex items-center gap-2">
                  <Package size={15} className="text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Rendimiento
                    </p>
                    <p className="text-slate-200 text-xs font-bold">
                      {product.unitsPerBox} u/caja
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={handleAddToCart}
              disabled={!hasStock}
              className={`flex items-center justify-center gap-2 h-12 rounded-2xl font-bold text-sm transition-all ${
                addedToCart
                  ? "bg-emerald-600 text-white"
                  : hasStock
                    ? "text-slate-900 hover:opacity-90"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
              style={hasStock && !addedToCart ? { background: "#CFAE70" } : {}}
            >
              {addedToCart ? (
                <CheckCircle2 size={18} />
              ) : (
                <ShoppingBag size={18} />
              )}
              {addedToCart ? "¡Agregado!" : "Agregar al carrito"}
            </button>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
            >
              <MessageCircle size={18} /> Cotizar por WhatsApp
            </a>
          </div>

          {/* Secondary actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowQR(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-[#CFAE70] hover:text-[#CFAE70] text-xs font-semibold transition-colors"
            >
              <QrCode size={14} /> Ver QR
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 text-xs font-semibold transition-colors"
            >
              <Share2 size={14} /> Compartir
            </button>
          </div>

          {/* Guarantee cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-slate-700/60 p-3 text-sm text-slate-300">
              <p className="mb-1 flex items-center gap-2 font-semibold text-slate-100">
                <CheckCircle2 size={16} className="text-[#CFAE70]" /> Calidad
                garantizada
              </p>
              Revisión y validación de producto antes del envío.
            </article>
            <article className="rounded-xl border border-slate-700/60 p-3 text-sm text-slate-300">
              <p className="mb-1 flex items-center gap-2 font-semibold text-slate-100">
                <AlertTriangle size={16} className="text-[#CFAE70]" /> Alta
                demanda
              </p>
              Producto en rotación, asegura tu pedido hoy.
            </article>
          </div>

          {/* Rating */}
          <article className="rounded-xl border border-slate-700/60 p-3 text-sm text-slate-300">
            <p className="mb-2 font-semibold text-slate-100">
              Opiniones recientes
            </p>
            <p className="flex items-center gap-1 text-amber-300">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star key={idx} size={14} fill="currentColor" />
              ))}
              <span className="ml-2 text-slate-300">
                4.9/5 por 128 clientes
              </span>
            </p>
          </article>
        </div>
      </section>

      {/* Related products */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-5 text-2xl font-black text-slate-100">
            Productos relacionados
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </section>
      )}

      {/* QR modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowQR(false)}
        >
          <div
            className="relative bg-slate-900 rounded-3xl border border-slate-700 p-6 w-full max-w-xs shadow-2xl text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X size={16} />
            </button>
            <div>
              <p className="text-white font-black text-base">{product.name}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                Escanea para ver la ficha del producto
              </p>
            </div>
            {qrDataUrl ? (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-2xl inline-block shadow">
                  <img src={qrDataUrl} alt="QR" className="size-48" />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-10">
                <div className="size-8 border-2 border-[#CFAE70] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <p className="text-[10px] text-slate-500 font-mono break-all">
              {publicUrl}
            </p>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`qr-${product.sku || product.id}.png`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
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
