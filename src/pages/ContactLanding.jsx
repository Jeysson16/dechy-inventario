import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import anime from "animejs";

/* ── Brand palette ── */
const G = "#6DC020"; // JIEDA green
const B = "#1B63AC"; // JIEDA blue

const SOCIALS = [
  {
    label: "Facebook",
    handle: "@JiedaImportaciones",
    url: "https://facebook.com/JiedaImportaciones",
    color: "#1877F2",
    bg: "rgba(24,119,242,0.1)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    handle: "@jieda.importaciones",
    url: "https://instagram.com/jieda.importaciones",
    color: "#E1306C",
    bg: "rgba(225,48,108,0.1)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    handle: "@jiedaimportaciones",
    url: "https://tiktok.com/@jiedaimportaciones",
    color: "#ffffff",
    bg: "rgba(255,255,255,0.07)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.31 6.31 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    handle: "+51 999 999 999",
    url: "https://wa.me/51999999999?text=Hola%2C%20quisiera%20realizar%20un%20pedido%20con%20Jieda%20Importaciones",
    color: "#25D366",
    bg: "rgba(37,211,102,0.1)",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

const PHONES = [
  { label: "Ventas directas", number: "+51 999 999 999", icon: "📦" },
  { label: "Soporte de pedidos", number: "+51 988 888 888", icon: "💬" },
  { label: "WhatsApp Business", number: "+51 977 777 777", icon: "🟢" },
];

const PARTICLES = [
  { x: "6%",  y: "15%", s: 4, c: G },
  { x: "20%", y: "78%", s: 3, c: B },
  { x: "48%", y: "8%",  s: 3, c: G },
  { x: "65%", y: "85%", s: 4, c: B },
  { x: "80%", y: "20%", s: 3, c: G },
  { x: "90%", y: "60%", s: 4, c: B },
  { x: "36%", y: "50%", s: 2, c: G },
];

const ContactLanding = () => {
  const containerRef = useRef(null);
  const cursorRef   = useRef(null);

  /* ── Main entrance timeline ── */
  useEffect(() => {
    const tl = anime.timeline({ easing: "easeOutExpo" });

    tl.add({
      targets: ".jl-sticker",
      opacity: [0, 1],
      scale: [0.78, 1],
      rotate: [-3, 0],
      duration: 780,
      delay: 120,
      easing: "easeOutBack",
    })
      .add(
        {
          targets: ".jl-tagline",
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 520,
        },
        "-=360"
      )
      .add(
        {
          targets: ".jl-divider",
          scaleX: [0, 1],
          opacity: [0, 1],
          duration: 560,
          easing: "easeOutQuart",
        },
        "-=260"
      )
      .add(
        {
          targets: ".jl-social-card",
          opacity: [0, 1],
          translateY: [30, 0],
          scale: [0.93, 1],
          duration: 580,
          delay: anime.stagger(90),
        },
        "-=320"
      )
      .add(
        {
          targets: ".jl-phone-item",
          opacity: [0, 1],
          translateX: [-22, 0],
          duration: 460,
          delay: anime.stagger(100),
        },
        "-=380"
      )
      .add(
        {
          targets: ".jl-footer-cta",
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 420,
        },
        "-=200"
      );

    /* SVG grid */
    anime({
      targets: ".jl-grid-line",
      opacity: [0, 0.09],
      duration: 1600,
      delay: anime.stagger(30, { from: "center" }),
      easing: "easeOutQuart",
    });

    /* Particles float */
    anime({
      targets: ".jl-particle",
      translateY: anime.stagger([-14, 14], { from: "random" }),
      translateX: anime.stagger([-7, 7], { from: "random" }),
      opacity: [0.22, 0.52],
      duration: anime.stagger([3200, 5600], { from: "random" }),
      loop: true,
      direction: "alternate",
      easing: "easeInOutSine",
      delay: anime.stagger(700, { from: "random" }),
    });

    /* Sticker idle float */
    anime({
      targets: ".jl-sticker",
      translateY: [-4, 4],
      duration: 3800,
      loop: true,
      direction: "alternate",
      easing: "easeInOutSine",
      delay: 900,
    });

    /* Pulse ring */
    anime({
      targets: ".jl-pulse-ring",
      scale: [1, 1.35],
      opacity: [0.35, 0],
      duration: 2200,
      loop: true,
      easing: "easeOutQuart",
      delay: anime.stagger(1100),
    });

    return () => tl.pause();
  }, []);

  /* ── Social card hover ── */
  const onCardEnter = (e) => {
    anime({ targets: e.currentTarget, translateY: -7, scale: 1.04, duration: 300, easing: "easeOutQuart" });
    anime({ targets: e.currentTarget.querySelector(".jl-card-strip"), opacity: [0, 1], scaleX: [0.4, 1], duration: 260, easing: "easeOutQuad" });
  };
  const onCardLeave = (e) => {
    anime({ targets: e.currentTarget, translateY: 0, scale: 1, duration: 380, easing: "easeOutExpo" });
    anime({ targets: e.currentTarget.querySelector(".jl-card-strip"), opacity: 0, duration: 200, easing: "easeInQuad" });
  };

  /* ── Cursor glow ── */
  useEffect(() => {
    const container = containerRef.current;
    const cursor    = cursorRef.current;
    if (!container || !cursor) return;
    let mx = 0, my = 0, cx = 0, cy = 0, rafId;
    const lerp = (a, b, t) => a + (b - a) * t;
    const onMove = (e) => {
      const r = container.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    };
    const tick = () => {
      cx = lerp(cx, mx, 0.09);
      cy = lerp(cy, my, 0.09);
      cursor.style.left = `${cx}px`;
      cursor.style.top  = `${cy}px`;
      rafId = requestAnimationFrame(tick);
    };
    container.addEventListener("mousemove", onMove);
    rafId = requestAnimationFrame(tick);
    return () => {
      container.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 20% 0%, #0E2040 0%, #060D1A 65%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Cursor glow */}
      <div
        ref={cursorRef}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          left: "50%", top: "50%",
          width: 280, height: 280,
          background: `radial-gradient(circle, ${G}22 0%, transparent 70%)`,
        }}
      />

      {/* SVG decorative grid */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {[1,2,3,4,5].map((i) => (
          <line key={`h${i}`} className="jl-grid-line" x1="0" y1={`${i*16.66}%`} x2="100%" y2={`${i*16.66}%`} stroke={G} strokeWidth="0.6" style={{ opacity: 0 }} />
        ))}
        {[1,2,3,4,5,6,7,8,9].map((i) => (
          <line key={`v${i}`} className="jl-grid-line" x1={`${i*11.11}%`} y1="0" x2={`${i*11.11}%`} y2="100%" stroke={B} strokeWidth="0.6" style={{ opacity: 0 }} />
        ))}
        <line className="jl-grid-line" x1="0" y1="100%" x2="28%" y2="0" stroke={G} strokeWidth="0.8" style={{ opacity: 0 }} />
        <line className="jl-grid-line" x1="72%" y1="100%" x2="100%" y2="0" stroke={B} strokeWidth="0.8" style={{ opacity: 0 }} />
      </svg>

      {/* Particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="jl-particle pointer-events-none absolute rounded-full"
          style={{ left: p.x, top: p.y, width: p.s, height: p.s, background: p.c, opacity: 0.3 }}
        />
      ))}

      {/* ── Main content ── */}
      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 py-14">

        {/* ══ STICKER logo ══ */}
        <div
          className="jl-sticker relative mb-2 flex flex-col items-center"
          style={{ opacity: 0, willChange: "transform, opacity" }}
        >
          {/* Pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="jl-pulse-ring absolute rounded-full border-2"
              style={{ width: 200, height: 200, borderColor: G, opacity: 0.35 }}
            />
            <div
              className="jl-pulse-ring absolute rounded-full border-2"
              style={{ width: 200, height: 200, borderColor: B, opacity: 0.28 }}
            />
          </div>

          {/* White sticker card */}
          <div
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-white px-8 py-6"
            style={{
              width: 220,
              boxShadow: `0 0 0 3px ${G}, 0 0 0 6px ${B}33, 0 24px 60px ${G}44, 0 8px 32px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Top gradient stripe */}
            <div
              className="absolute inset-x-0 top-0 h-1.5 rounded-t-3xl"
              style={{ background: `linear-gradient(90deg, ${G}, ${B})` }}
            />
            <img
              src="/img/LOGO JIEDA.png"
              alt="JieDa Importaciones"
              className="h-28 w-28 object-contain"
              draggable={false}
            />
            <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: B }}>
              Jieda
            </p>
            <p className="text-center text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: G }}>
              Importaciones
            </p>
            {/* Bottom gradient stripe */}
            <div
              className="absolute inset-x-0 bottom-0 h-1 rounded-b-3xl"
              style={{ background: `linear-gradient(90deg, ${B}, ${G})` }}
            />
          </div>

          {/* Label badge */}
          <span
            className="mt-3 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-white"
            style={{ background: `linear-gradient(90deg, ${B}, ${G})` }}
          >
            Somos Importadores
          </span>
        </div>

        {/* Tagline */}
        <p
          className="jl-tagline mt-6 max-w-sm text-center text-sm leading-relaxed"
          style={{ opacity: 0, color: "#8BAFD4" }}
        >
          Contáctanos directamente para hacer tu pedido, consultar stock o resolver cualquier duda.
        </p>

        {/* Divider */}
        <div
          className="jl-divider my-8 h-px w-20 rounded-full"
          style={{ opacity: 0, transformOrigin: "center", background: `linear-gradient(90deg, ${G}, ${B})` }}
        />

        {/* ── Social cards ── */}
        <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="jl-social-card relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border px-3 py-5"
              style={{
                opacity: 0,
                background: s.bg,
                borderColor: `${s.color}33`,
                willChange: "transform, opacity",
              }}
              onMouseEnter={onCardEnter}
              onMouseLeave={onCardLeave}
            >
              <div
                className="jl-card-strip pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-full"
                style={{ background: s.color, opacity: 0, transformOrigin: "left" }}
              />
              <span style={{ color: s.color }}>{s.icon}</span>
              <div className="text-center">
                <p className="text-sm font-black text-white">{s.label}</p>
                <p className="mt-0.5 text-[11px]" style={{ color: "#6B8EAE" }}>{s.handle}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Section divider */}
        <div className="my-8 flex w-full max-w-xl items-center gap-3">
          <div className="h-px flex-1" style={{ background: `${B}44` }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: G }}>
            Llámanos
          </span>
          <div className="h-px flex-1" style={{ background: `${G}44` }} />
        </div>

        {/* ── Phone list ── */}
        <div className="w-full max-w-sm space-y-3">
          {PHONES.map((p) => (
            <a
              key={p.label}
              href={`tel:${p.number.replace(/\s/g, "")}`}
              className="jl-phone-item flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors"
              style={{
                opacity: 0,
                background: "rgba(27,99,172,0.08)",
                borderColor: `${B}33`,
                willChange: "transform, opacity",
              }}
              onMouseEnter={(e) => anime({ targets: e.currentTarget, borderColor: `${G}88`, duration: 240, easing: "easeOutQuad" })}
              onMouseLeave={(e) => anime({ targets: e.currentTarget, borderColor: `${B}33`, duration: 280, easing: "easeOutQuad" })}
            >
              <span className="text-2xl leading-none">{p.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#6B8EAE" }}>
                  {p.label}
                </p>
                <p className="mt-0.5 truncate text-base font-black text-white">
                  {p.number}
                </p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" style={{ color: G }} aria-hidden="true">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </a>
          ))}
        </div>

        {/* Footer CTA */}
        <div
          className="jl-footer-cta mt-12 flex flex-col items-center gap-3 text-center"
          style={{ opacity: 0 }}
        >
          <Link
            to="/tienda"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-80"
            style={{ background: `linear-gradient(135deg, ${B}, ${G})` }}
          >
            Visitar tienda online →
          </Link>
          <p className="text-xs" style={{ color: "#3A567A" }}>
            © {new Date().getFullYear()} JieDa Importaciones · Trujillo, Perú
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactLanding;
