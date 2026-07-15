import { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  MessageCircle,
  Mail,
  Phone,
  Loader2,
  CheckCircle,
  MapPin,
  Clock,
} from "lucide-react";
import anime from "animejs";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./ContactLanding.css";

/* ── Leaflet icon fix for Vite bundlers ── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* ── Design tokens ── */
const ACCENT = "#2fcd1d";
const BG = "#e8e4dc";
const DARK = "#1a1a2e";
const BODY = "#444444";

/* ── Trujillo coordinates ── */
const COORDS = [-8.1116, -79.0287];

/* ── Navigation ── */
const NAV_LINKS = [
  { to: "/contacto", label: "HOME", external: false },
  { to: "/tienda/catalogo", label: "CATÁLOGO", external: false },
  { to: "/tienda/catalogo", label: "NOSOTROS", external: false },
  { href: "https://wa.me/51919066888", label: "SOPORTE", external: true },
];

/* ── Contact channels ── */
const CHANNELS = [
  {
    id: "whatsapp",
    icon: <MessageCircle size={32} />,
    label: "WhatsApp",
    value: "+51 919 066 888",
    href: "https://wa.me/51919066888?text=%C2%A1Hola!%20%F0%9F%91%8B%20Bienvenido%20a%20*Dechy%20Importaciones*%20%F0%9F%8F%AA%E2%9C%A8.%20Estamos%20encantados%20de%20atenderte.%20%C2%BFEn%20qu%C3%A9%20podemos%20ayudarte%3F",
    sub: "Respuesta rápida",
  },
  {
    id: "phone",
    icon: <Phone size={32} />,
    label: "Teléfono",
    value: "+51 919 066 888",
    href: "tel:+51919066888",
    sub: "Lun–Dom 8:30 a.m. – 7:00 p.m.",
  },
  {
    id: "email",
    icon: <Mail size={32} />,
    label: "Correo",
    value: "dechyimportaciones@gmail.com",
    href: "mailto:dechyimportaciones@gmail.com",
    sub: "Respuesta en menos de 24 h",
  },
];

/* ── Email regex ── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Productos para el carrusel
   Para añadir más: duplica un objeto y actualiza id, tag, name e img.
   Cuando tengas las imágenes coloca: src={p.img} en el <img> de cada card ── */
const PRODUCTS = [
  {
    id: 1,
    tag: "→ Lo Esencial",
    name: "CIELO RASO",
    brand: "dechy",
    slug: "cielo-raso",
    img: "/img/landing/productos/negro.png",
    can: "/img/landing/productos/negro.png",
  },
  {
    id: 2,
    tag: "→ Sin Azúcar",
    name: "PANEL BLANCO",
    brand: "dechy",
    slug: "panel-blanco",
    img: "/img/landing/productos/blanco.png",
    can: "/img/landing/productos/blanco.png",
  },
  {
    id: 3,
    tag: "→ Premium",
    name: "PANEL ROSADO",
    brand: "dechy",
    slug: "panel-rosado",
    img: "/img/landing/productos/rosadoa.png",
    can: "/img/landing/productos/rosadoa.png",
  },
];

export default function ContactLanding() {
  /* ── Form state ── */
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [hoveredProduct, setHoveredProduct] = useState(null);

  /* ── Refs ── */
  const waveRef = useRef(null);
  const rippleRefs = useRef([]);
  const logoWrapRef = useRef(null);

  /* ── Wave entrance animation ── */
  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const obj = { x: 0, at: 0 };
          anime({
            targets: obj,
            x: 120,
            at: 50,
            duration: 1200,
            easing: "cubicBezier(0.25, 0.46, 0.45, 0.94)",
            update() {
              el.style.clipPath = `ellipse(${obj.x}% 80px at ${obj.at}% 100%)`;
            },
            complete() {
              el.style.clipPath = "ellipse(120% 80px at 50% 100%)";
            },
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ── Ripple effect ── */
  function handleRipple(e, index) {
    const container = rippleRefs.current[index];
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement("div");
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0px;
      height: 0px;
      border-radius: 50%;
      background: ${ACCENT}33;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    `;
    container.appendChild(ripple);
    anime({
      targets: ripple,
      width: [0, 350],
      height: [0, 350],
      opacity: [1, 0],
      duration: 600,
      easing: "easeOutExpo",
      complete: () => ripple.remove(),
    });
  }

  /* ── Shockwave rings after logo lands ── */
  function triggerShockwave() {
    const wrap = logoWrapRef.current;
    if (!wrap) return;
    [0, 180, 360].forEach((delay) => {
      const ring = document.createElement("div");
      ring.style.cssText = `
        position:absolute; top:50%; left:50%;
        width:0; height:0; border-radius:50%;
        border:3px solid ${ACCENT};
        transform:translate(-50%,-50%);
        pointer-events:none; opacity:1;
      `;
      wrap.appendChild(ring);
      anime({
        targets: ring,
        width: [0, 700],
        height: [0, 700],
        opacity: [0.85, 0],
        duration: 1400,
        delay,
        easing: "easeOutExpo",
        complete: () => ring.remove(),
      });
    });
  }

  /* ── Form validation ── */
  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Campo requerido";
    if (!form.email.trim()) e.email = "Campo requerido";
    else if (!EMAIL_RE.test(form.email)) e.email = "Correo inválido";
    if (!form.subject.trim()) e.subject = "Campo requerido";
    if (!form.message.trim()) e.message = "Campo requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ── Form submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 1800));
    setSending(false);
    setSent(true);
  }

  return (
    <>
      {/* ══ BOTÓN HAMBURGER FLOTANTE CIRCULAR ══ */}
      {!menuOpen && (
        <button
          className="jc-ham-fab"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          <span className="jc-ham-line" />
          <span className="jc-ham-line" />
          <span className="jc-ham-line" />
        </button>
      )}

      {/* ══════════════════════════════════════════
          NAV — sticky, logo centrado
      ══════════════════════════════════════════ */}
      <nav className="jc-nav" aria-label="Navegación principal">
        <div className="jc-nav-inner">
          <div className="jc-nav-logo">
            <img
              src="/img/brand/logopngdechy.png"
              alt="JieDa Importaciones"
              className="jc-nav-logo-img"
            />
          </div>
        </div>
      </nav>

      {/* ══ OVERLAY MENÚ — 2 columnas ══ */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="jc-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            {/* ── Panel izquierdo: rojo ── */}
            <motion.div
              className="jc-menu-left"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <button
                className="jc-overlay-close"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                ✕
              </button>

              {/* Navegación principal */}
              <nav className="jc-overlay-nav">
                {NAV_LINKS.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 + 0.15 }}
                  >
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="jc-overlay-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <NavLink
                        to={link.to}
                        className={({ isActive }) =>
                          `jc-overlay-link${isActive ? " jc-overlay-link--active" : ""}`
                        }
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                      </NavLink>
                    )}
                  </motion.div>
                ))}
              </nav>

              {/* Sección productos en menú */}
              <div className="jc-menu-products">
                <p className="jc-menu-products-label">PRODUCTOS</p>
                {PRODUCTS.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 + 0.4 }}
                    onMouseEnter={() => setHoveredProduct(p)}
                    onMouseLeave={() => setHoveredProduct(null)}
                  >
                    <NavLink
                      to={`/products/${p.brand}/${p.slug}/`}
                      className="jc-menu-product-link"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="jc-menu-product-tag">{p.tag}</span>
                      <span className="jc-menu-product-name">{p.name}</span>
                    </NavLink>
                  </motion.div>
                ))}
              </div>

              <p className="jc-overlay-footer">
                JieDa Importaciones · Trujillo, Perú
              </p>
            </motion.div>

            {/* ── Panel derecho: beige ── */}
            <motion.div
              className="jc-menu-right"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="jc-menu-right-logo">
                <img
                  src="/img/brand/logopngdechy.png"
                  alt="JieDa Importaciones"
                  className="jc-menu-right-logo-img"
                />
              </div>
              {/* Imagen de producto aparece en bottom-right al hacer hover */}
              <AnimatePresence>
                {hoveredProduct && (
                  <motion.img
                    key={hoveredProduct.id}
                    src={hoveredProduct.can}
                    alt={hoveredProduct.name}
                    className="jc-menu-can-img"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ background: BG, color: BODY, fontFamily: "inherit" }}>
        {/* ══════════════════════════════════════════
            §1  HERO
        ══════════════════════════════════════════ */}
        <section className="jc-hero" style={{ background: BG }}>
          {/* Círculos SVG decorativos de fondo */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
            style={{ opacity: 0.05 }}
          >
            <circle
              cx="50%"
              cy="50%"
              r="340"
              fill="none"
              stroke={DARK}
              strokeWidth="1"
            />
            <circle
              cx="50%"
              cy="50%"
              r="240"
              fill="none"
              stroke={DARK}
              strokeWidth="1"
            />
            <circle
              cx="50%"
              cy="50%"
              r="140"
              fill="none"
              stroke={DARK}
              strokeWidth="1"
            />
          </svg>

          {/* Grid de 3 columnas: logo circular | imagen+título | subtítulo */}
          <div className="jc-hero-grid">
            {/* ── Izquierda: logo circular estilo RC ── */}
            <motion.div
              className="jc-hero-left"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.35 }}
            ></motion.div>

            {/* ── Centro: imagen PNG + título gigante ── */}
            <div className="jc-hero-center">
              {/* Imagen PNG del producto — flota encima del texto (z-index 3)
                  Para colocar tu imagen real, reemplaza el SVG por:
                  <img
                    src="/img/landing/productos/hero.png"
                    alt="Producto estrella JieDa"
                    className="jc-hero-product-img"
                  />
              */}
              <motion.div
                className="jc-hero-img-wrap"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.1 }}
              >
                <img
                  src="/img/brand/logopngdechy.png"
                  alt="JieDa Importaciones"
                  className="jc-hero-product-img"
                />
              </motion.div>
            </div>

            {/* ── Derecha: subtítulo pequeño ── */}
            <motion.div
              className="jc-hero-right"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <p className="jc-hero-subtitle">
                Experience
                <br />
                true freshness
                <br />
                <span
                  style={{
                    fontFamily: "'Anton', sans-serif",
                    fontSize: "0.62em",
                    letterSpacing: 2,
                    color: DARK,
                    fontStyle: "normal",
                    display: "block",
                    marginTop: "0.4em",
                  }}
                >
                  MATERIALES PREMIUM
                </span>
              </p>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="jc-scroll-indicator"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown size={32} style={{ color: ACCENT }} />
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════
          §1b NUESTRA EMPRESA
      ══════════════════════════════════════════ */}
        <section
          className="py-24 px-6 overflow-hidden"
          style={{ background: BG }}
        >
          <div className="mx-auto max-w-5xl grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — texto */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
            >
              <p
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 20,
                  color: BODY,
                  marginBottom: 8,
                }}
              >
                Algo sobre nosotros
              </p>
              <h2
                style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: "clamp(56px, 9vw, 100px)",
                  color: DARK,
                  lineHeight: 0.9,
                  marginBottom: "1.5rem",
                  letterSpacing: "-0.01em",
                }}
              >
                NUESTRA
                <br />
                EMPRESA
              </h2>
              <p
                style={{
                  color: BODY,
                  lineHeight: 1.75,
                  maxWidth: 380,
                  marginBottom: "2rem",
                }}
              >
                JieDa Importaciones, especialistas en cielo raso modular,
                paneles decorativos y materiales de acabado premium.
                Comprometidos con la calidad y la entrega puntual en Trujillo y
                todo el Perú.
              </p>
              <NavLink to="/tienda/catalogo" className="jc-about-link">
                Ver catálogo
              </NavLink>
            </motion.div>

            {/* Right — productos staggered (estilo Royal Bev) */}
            <div className="flex items-end justify-center relative h-90 sm:h-80">
              {[
                {
                  src: "/img/landing/productos/negro.png",
                  heightPct: "142%",
                  initRotate: -12,
                  finalRotate: -9,
                  marginRight: "-190px",
                  zIndex: 1,
                  delay: 0.15,
                  initX: -40,
                },
                {
                  src: "/img/landing/productos/blanco.png",
                  heightPct: "150%",
                  initRotate: 0,
                  finalRotate: 2,
                  marginRight: 0,
                  zIndex: 3,
                  delay: 0,
                  initX: 0,
                },
                {
                  src: "/img/landing/productos/rosadoa.png",
                  heightPct: "140%",
                  initRotate: 12,
                  finalRotate: 9,
                  marginLeft: "-190px",
                  zIndex: 1,
                  delay: 0.25,
                  initX: 40,
                },
              ].map((item, i) => (
                <motion.img
                  key={i}
                  src={item.src}
                  alt={`Producto JieDa ${i + 1}`}
                  style={{
                    height: item.heightPct,
                    width: "auto",
                    objectFit: "contain",
                    filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.18))",
                    zIndex: item.zIndex,
                    position: "relative",
                    marginRight: item.marginRight ?? 0,
                    marginLeft: item.marginLeft ?? 0,
                    flexShrink: 0,
                  }}
                  initial={{
                    opacity: 0,
                    y: 50,
                    x: item.initX,
                    rotate: item.initRotate,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                    x: 0,
                    rotate: item.finalRotate,
                  }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{
                    duration: 0.7,
                    delay: item.delay,
                    ease: "easeOut",
                  }}
                  whileHover={{
                    scale: 1.07,
                    zIndex: 10,
                    rotate: 0,
                    transition: { duration: 0.25 },
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
          §2  WAVE TRANSITION
      ══════════════════════════════════════════ */}
        <div
          ref={waveRef}
          className="jc-wave-divider"
          style={{ height: 100, background: ACCENT, marginTop: -1 }}
        />

        {/* ══════════════════════════════════════════
            §5  OUR PRODUCTS
        ══════════════════════════════════════════ */}
        <section className="jc-products-section" style={{ background: ACCENT }}>
          {/* Círculos SVG concéntricos — stroke blanco semitransparente */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
            style={{ opacity: 0.08 }}
          >
            <circle
              cx="50%"
              cy="50%"
              r="100"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <circle
              cx="50%"
              cy="50%"
              r="200"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <circle
              cx="50%"
              cy="50%"
              r="320"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <circle
              cx="50%"
              cy="50%"
              r="450"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>

          <div className="jc-products-inner">
            {/* Cabecera: tag + título a la izquierda, contador a la derecha */}
            <div className="jc-products-header">
              <div>
                <motion.p
                  className="jc-products-tag"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7 }}
                >
                  Conoce nuestros
                </motion.p>
                <motion.h2
                  className="jc-products-title"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                >
                  OTROS PRODUCTOS
                </motion.h2>
              </div>
              {/* Contador — grande y semitransparente */}
              <span className="jc-carousel-counter" aria-live="polite">
                {activeSlide + 1} / {PRODUCTS.length}
              </span>
            </div>

            {/* Carrusel horizontal */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="jc-carousel-wrapper">
                <div
                  className="jc-carousel-track"
                  style={{
                    transform: `translateX(-${activeSlide * (100 / PRODUCTS.length)}%)`,
                    transition: "transform 0.6s cubic-bezier(.25,.46,.45,.94)",
                  }}
                >
                  {PRODUCTS.map((p) => (
                    <div key={p.id} className="jc-carousel-card">
                      {/* Círculo spotlight detrás del producto */}
                      <div className="jc-spotlight">
                        {/*
                          ╔══════════════════════════════════════╗
                          ║  IMAGEN PRODUCTO — para colocarla:   ║
                          ║  Reemplaza el <svg> por:             ║
                          ║  <img                                ║
                          ║    src={p.img}                       ║
                          ║    alt={p.name}                      ║
                          ║    className="jc-card-img"           ║
                          ║    loading="lazy"                    ║
                          ║  />                                  ║
                          ╚══════════════════════════════════════╝
                        */}
                        <svg
                          viewBox="0 0 200 280"
                          className="jc-card-img"
                          role="img"
                          aria-label={`Placeholder — coloca tu imagen en ${p.img}`}
                        >
                          <rect
                            x="70"
                            y="20"
                            width="60"
                            height="240"
                            rx="30"
                            fill="rgba(255,255,255,0.12)"
                          />
                          <rect
                            x="80"
                            y="35"
                            width="40"
                            height="210"
                            rx="20"
                            fill="rgba(255,255,255,0.22)"
                          />
                          <text
                            x="100"
                            y="158"
                            textAnchor="middle"
                            style={{
                              fill: "#f0e8dc",
                              fontFamily: "Anton,sans-serif",
                              fontSize: "11px",
                              fontStyle: "italic",
                            }}
                          >
                            {p.name}
                          </text>
                          <text
                            x="100"
                            y="174"
                            textAnchor="middle"
                            style={{
                              fill: "rgba(240,232,220,0.55)",
                              fontFamily: "Arial",
                              fontSize: "8px",
                            }}
                          >
                            {p.img.split("/").pop()}
                          </text>
                        </svg>
                      </div>

                      {/* Información debajo */}
                      <p className="jc-card-tag">{p.tag}</p>
                      <h3 className="jc-card-name">{p.name}</h3>
                      <button
                        className="jc-view-btn"
                        aria-label={`Ver producto ${p.name}`}
                      >
                        VIEW PRODUCT
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de navegación ← → */}
              <div className="jc-carousel-nav">
                <button
                  className="jc-nav-arrow"
                  onClick={() => setActiveSlide((i) => Math.max(0, i - 1))}
                  disabled={activeSlide === 0}
                  aria-label="Producto anterior"
                >
                  ←
                </button>
                <button
                  className="jc-nav-arrow"
                  onClick={() =>
                    setActiveSlide((i) => Math.min(PRODUCTS.length - 1, i + 1))
                  }
                  disabled={activeSlide === PRODUCTS.length - 1}
                  aria-label="Producto siguiente"
                >
                  →
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
          §3  CONTACT CHANNELS
      ══════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden py-24 px-6"
          style={{ background: ACCENT }}
        >
          {/* Background SVG concentric rings */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
            style={{ opacity: 0.08 }}
          >
            <circle
              cx="50%"
              cy="50%"
              r="120"
              fill="none"
              stroke={DARK}
              strokeWidth="1.5"
            />
            <circle
              cx="50%"
              cy="50%"
              r="200"
              fill="none"
              stroke={DARK}
              strokeWidth="1.5"
            />
            <circle
              cx="50%"
              cy="50%"
              r="280"
              fill="none"
              stroke={DARK}
              strokeWidth="1.5"
            />
          </svg>

          <div className="relative z-10 mx-auto max-w-4xl">
            {/* Caveat tag */}
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: 22,
                color: DARK,
                textAlign: "center",
                marginBottom: "0.5rem",
              }}
            >
              ¿Cómo prefieres hablar con nosotros?
            </motion.p>

            {/* Heading */}
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: "clamp(40px, 7vw, 80px)",
                color: DARK,
                textAlign: "center",
                marginBottom: "3rem",
                letterSpacing: "-0.01em",
              }}
            >
              CONTACTO DIRECTO
            </motion.h2>

            {/* Channel cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {CHANNELS.map((ch, i) => (
                <motion.a
                  key={ch.id}
                  href={ch.href}
                  target={ch.id !== "phone" ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="jc-contact-card flex flex-col items-center gap-3 text-center"
                  style={{ color: DARK }}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: i * 0.15 }}
                >
                  <span style={{ color: DARK }}>{ch.icon}</span>
                  <div>
                    <p
                      style={{
                        fontFamily: "'Anton', sans-serif",
                        fontSize: 22,
                        letterSpacing: "0.03em",
                      }}
                    >
                      {ch.label}
                    </p>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        marginTop: 4,
                      }}
                    >
                      {ch.value}
                    </p>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        opacity: 0.7,
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <Clock size={12} />
                      {ch.sub}
                    </p>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
          §4  CONTACT FORM
      ══════════════════════════════════════════ */}
        <section className="py-24 px-6" style={{ background: BG }}>
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
            {/* Left — info */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
            >
              <p
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 22,
                  color: ACCENT,
                  marginBottom: 8,
                }}
              >
                Escríbenos
              </p>
              <h2
                style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: "clamp(36px, 5vw, 60px)",
                  color: DARK,
                  lineHeight: 1,
                  marginBottom: "1.5rem",
                }}
              >
                ENVÍANOS UN MENSAJE
              </h2>
              <p style={{ color: BODY, lineHeight: 1.7, maxWidth: 380 }}>
                ¿Tienes una consulta, quieres hacer un pedido o simplemente
                quieres saber más sobre nuestros productos? Llena el formulario
                y te respondemos pronto.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  {
                    icon: <MapPin size={18} />,
                    text: "Trujillo, La Libertad — Perú",
                  },
                  { icon: <Phone size={18} />, text: "+51 919 066 888" },
                  {
                    icon: <Clock size={18} />,
                    text: "Lun–Dom · 8:30 a.m. – 7:00 p.m.",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                    style={{ color: BODY }}
                  >
                    <span style={{ color: ACCENT }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — form */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
            >
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                    style={{ gap: "1rem" }}
                  >
                    <CheckCircle size={56} style={{ color: ACCENT }} />
                    <h3
                      style={{
                        fontFamily: "'Anton', sans-serif",
                        fontSize: 32,
                        color: DARK,
                      }}
                    >
                      ¡MENSAJE ENVIADO!
                    </h3>
                    <p style={{ color: BODY, maxWidth: 320 }}>
                      Gracias por escribirnos. Te responderemos a la brevedad
                      posible.
                    </p>
                    <button
                      onClick={() => {
                        setSent(false);
                        setForm({
                          name: "",
                          email: "",
                          subject: "",
                          message: "",
                        });
                      }}
                      className="jc-send-btn"
                      style={{ marginTop: "1rem" }}
                    >
                      Enviar otro
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    noValidate
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {/* Name */}
                    <div>
                      <input
                        className="jc-form-input"
                        type="text"
                        placeholder="Tu nombre *"
                        value={form.name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, name: e.target.value }))
                        }
                      />
                      {errors.name && (
                        <p
                          style={{
                            color: "#e53e3e",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {errors.name}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <input
                        className="jc-form-input"
                        type="email"
                        placeholder="Tu correo electrónico *"
                        value={form.email}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, email: e.target.value }))
                        }
                      />
                      {errors.email && (
                        <p
                          style={{
                            color: "#e53e3e",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <input
                        className="jc-form-input"
                        type="text"
                        placeholder="Asunto *"
                        value={form.subject}
                        DÓNDE
                        ESTAMOSJieDa
                        Importac
                        onChange={(e) =>
                          setForm((p) => ({ ...p, subject: e.target.value }))
                        }
                      />
                      {errors.subject && (
                        <p
                          style={{
                            color: "#e53e3e",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {errors.subject}
                        </p>
                      )}
                    </div>

                    {/* Message */}
                    <div>
                      <textarea
                        className="jc-form-input"
                        rows={5}
                        placeholder="Tu mensaje *"
                        style={{ resize: "vertical" }}
                        value={form.message}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, message: e.target.value }))
                        }
                      />
                      {errors.message && (
                        <p
                          style={{
                            color: "#e53e3e",
                            fontSize: 12,
                            marginTop: 4,
                          }}
                        >
                          {errors.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="jc-send-btn"
                      style={{ alignSelf: "flex-start" }}
                    >
                      {sending ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar mensaje"
                      )}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
          §5  MAP
      ══════════════════════════════════════════ */}
        <section className="py-20 px-6" style={{ background: DARK }}>
          <div className="mx-auto max-w-5xl">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7 }}
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: "clamp(36px, 6vw, 72px)",
                color: ACCENT,
                textAlign: "center",
                marginBottom: "2rem",
              }}
            >
              DÓNDE ESTAMOS
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              style={{ borderRadius: 12, overflow: "hidden" }}
            >
              <MapContainer
                center={COORDS}
                zoom={15}
                scrollWheelZoom={false}
                style={{ height: 400, width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={COORDS}>
                  <Popup>
                    <strong>JieDa Importaciones</strong>
                    <br />
                    Trujillo, La Libertad — Perú
                    <br />
                    +51 919 066 888
                  </Popup>
                </Marker>
              </MapContainer>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
          §6  FOOTER LINKS
      ══════════════════════════════════════════ */}
        <footer className="py-16 px-6" style={{ background: BG }}>
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              {NAV_LINKS.map((link, i) => (
                <div
                  key={link.label}
                  className="jc-ripple-container"
                  ref={(el) => (rippleRefs.current[i] = el)}
                  onClick={(e) => handleRipple(e, i)}
                >
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="jc-footer-link"
                      style={{
                        fontFamily: "'Anton', sans-serif",
                        fontSize: "clamp(28px, 5vw, 56px)",
                        color: DARK,
                      }}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <NavLink
                      to={link.to}
                      className={({ isActive }) =>
                        `jc-footer-link${isActive ? " jc-footer-link--active" : ""}`
                      }
                      style={({ isActive }) => ({
                        fontFamily: "'Anton', sans-serif",
                        fontSize: "clamp(28px, 5vw, 56px)",
                        color: isActive ? ACCENT : DARK,
                      })}
                    >
                      {link.label}
                    </NavLink>
                  )}
                </div>
              ))}
            </div>
            <p
              style={{
                textAlign: "center",
                marginTop: "3rem",
                fontSize: "0.8rem",
                color: "#888",
              }}
            >
              © {new Date().getFullYear()} JieDa Importaciones · Trujillo, Perú
              · Todos los derechos reservados
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
