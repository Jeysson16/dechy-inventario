/**
 * HeroCarousel — full-width auto-playing promotional slider.
 * Slides are defined below; replace images in public/img/carousel/
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ── Slide data — edit text, links and image paths here ── */
const SLIDES = [
  {
    id: 1,
    image: "/img/banners/hero/deco3.jpg",
    badge: "Nueva Colección 2026",
    title: "Acabados premium\npara tu hogar",
    subtitle:
      "Cielo raso modular, porcelanatos y más materiales de construcción con entrega inmediata.",
    cta: "Ver catálogo",
    ctaLink: "/tienda/catalogo",
    ctaSecondary: "Cotizar",
    ctaSecondaryLink: `https://wa.me/51919066888?text=${encodeURIComponent("Hola Jieda! Quiero cotizar un producto.")}`,
    bg: "from-[#1a2842] to-[#0b1220]",
    accent: "#CFAE70",
  },
  {
    id: 2,
    image: "/img/banners/hero/deco2.png",
    badge: "Oferta especial",
    title: "Hasta 30% OFF\nen productos seleccionados",
    subtitle:
      "Aprovecha nuestras ofertas de temporada en cielo raso, paneles y accesorios.",
    cta: "Ver ofertas",
    ctaLink: "/tienda/catalogo",
    ctaSecondary: null,
    bg: "from-[#1c1a2e] to-[#0a0a1a]",
    accent: "#F97316",
  },
  {
    id: 3,
    image: "/img/banners/hero/deco1.jpg",
    badge: "Envío a todo el país",
    title: "Materiales de\ncalidad garantizada",
    subtitle:
      "Stock en tiempo real, seguimiento de pedido y atención personalizada.",
    cta: "Explorar",
    ctaLink: "/tienda/catalogo",
    ctaSecondary: null,
    bg: "from-[#0d2818] to-[#0a1a0e]",
    accent: "#4ADE80",
  },
];

const INTERVAL_MS = 2000;

const HeroCarousel = () => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef(null);
  const navigate = useNavigate();
  const count = SLIDES.length;

  const goTo = useCallback(
    (idx) => {
      setCurrent(((idx % count) + count) % count);
    },
    [count],
  );

  const prev = () => goTo(current - 1);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  /* Auto-play */
  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(next, INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [next, paused]);

  const slide = SLIDES[current];

  return (
    <div
      className="shop-carousel w-full"
      style={{ height: "min(580px, 62vw)", minHeight: 340 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Track */}
      <div
        className="shop-carousel-track"
        style={{ transform: `translateX(-${current * 100}%)`, height: "100%" }}
      >
        {SLIDES.map((s, idx) => (
          <div
            key={s.id}
            className="shop-carousel-slide"
            style={{ height: "100%" }}
          >
            {/* Background image */}
            {s.image && (
              <img
                src={s.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading={idx === 0 ? "eager" : "lazy"}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            {/* Gradient overlay — lightened so image shows through */}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${s.bg} opacity-55`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

            {/* Content */}
            <div className="relative z-10 h-full flex items-center">
              <div className="shop-shell w-full">
                <div className="max-w-xl py-10">
                  {/* Badge */}
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
                    style={{
                      background: `${s.accent}22`,
                      color: s.accent,
                      border: `1px solid ${s.accent}44`,
                    }}
                  >
                    ✦ {s.badge}
                  </span>
                  {/* Title */}
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight whitespace-pre-line mb-4">
                    {s.title}
                  </h1>
                  {/* Subtitle */}
                  <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-md">
                    {s.subtitle}
                  </p>
                  {/* CTAs */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => navigate(s.ctaLink)}
                      className="btn-accent"
                      style={{ background: s.accent }}
                    >
                      {s.cta}
                    </button>
                    {s.ctaSecondary && (
                      <button
                        onClick={() => navigate(s.ctaSecondaryLink)}
                        className="btn-outline"
                        style={{
                          color: "white",
                          borderColor: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {s.ctaSecondary}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Arrow controls */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors z-20"
        aria-label="Anterior"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors z-20"
        aria-label="Siguiente"
      >
        <ChevronRight size={20} />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={`shop-carousel-dot ${idx === current ? "active" : ""}`}
            aria-label={`Ir a slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;
