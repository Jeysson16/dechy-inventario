import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import anime from "animejs";
import Button from "./Button";

const HERO_WORDS = "Elegancia minimalista, entrega que inspira.".split(" ");

const STATS = [
  { label: "Productos", value: 500, suffix: "+" },
  { label: "Pedidos", value: 1200, suffix: "+" },
  { label: "Clientes", value: 350, suffix: "+" },
];

const PARTICLES = [
  { x: "11%", y: "22%", s: 3 },
  { x: "29%", y: "70%", s: 2 },
  { x: "43%", y: "11%", s: 2 },
  { x: "57%", y: "80%", s: 4 },
  { x: "70%", y: "19%", s: 2 },
  { x: "40%", y: "58%", s: 3 },
];

const ShopHero = () => {
  const containerRef = useRef(null);
  const cursorRef = useRef(null);
  const subtitleRef = useRef(null);
  const navigate = useNavigate();

  /* ── Main timeline ── */
  useEffect(() => {
    const tl = anime.timeline({ easing: "easeOutExpo" });

    tl.add({
      targets: ".hero-badge",
      opacity: [0, 1],
      scale: [0.82, 1],
      duration: 600,
      delay: 150,
    })
      .add(
        {
          targets: ".hero-grid-h",
          opacity: [0, 0.12],
          duration: 900,
          delay: anime.stagger(55, { from: "center" }),
          easing: "easeOutExpo",
        },
        "-=300",
      )
      .add(
        {
          targets: ".hero-grid-v",
          opacity: [0, 0.09],
          duration: 900,
          delay: anime.stagger(35, { from: "center" }),
          easing: "easeOutExpo",
        },
        "-=800",
      )
      .add(
        {
          targets: ".hero-diagonal",
          opacity: [0, 0.22],
          duration: 1100,
          delay: anime.stagger(220),
          easing: "easeOutQuart",
        },
        "-=500",
      )
      .add(
        {
          targets: ".hero-word",
          opacity: [0, 1],
          translateY: [34, 0],
          duration: 680,
          delay: anime.stagger(72),
          easing: "easeOutBack",
        },
        "-=700",
      )
      .add(
        {
          targets: subtitleRef.current,
          opacity: [0, 1],
          translateY: [18, 0],
          duration: 600,
        },
        "-=380",
      )
      .add(
        {
          targets: ".hero-cta",
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 500,
          delay: anime.stagger(90),
        },
        "-=320",
      )
      .add(
        {
          targets: ".hero-stat-item",
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 480,
          delay: anime.stagger(80),
        },
        "-=220",
      );

    /* Counter animation */
    document.querySelectorAll(".stat-num").forEach((el) => {
      const target = parseInt(el.getAttribute("data-value"), 10);
      const suffix = el.getAttribute("data-suffix") || "";
      const obj = { val: 0 };
      anime({
        targets: obj,
        val: target,
        round: 1,
        easing: "easeOutQuart",
        duration: 1700,
        delay: 1600,
        update: () => {
          el.textContent = `${Math.round(obj.val)}${suffix}`;
        },
      });
    });

    /* Floating particles */
    anime({
      targets: ".shop-particle",
      translateY: anime.stagger([-14, 14], { from: "random" }),
      translateX: anime.stagger([-8, 8], { from: "random" }),
      opacity: [0.22, 0.55],
      duration: anime.stagger([3200, 5200], { from: "random" }),
      loop: true,
      direction: "alternate",
      easing: "easeInOutSine",
      delay: anime.stagger(500, { from: "random" }),
    });

    /* Ring rotations */
    anime({
      targets: ".hero-ring-outer",
      rotate: [0, 360],
      duration: 52000,
      loop: true,
      easing: "linear",
    });
    anime({
      targets: ".hero-ring-inner",
      rotate: [0, -360],
      duration: 15000,
      loop: true,
      easing: "linear",
    });

    /* Dot pulse */
    anime({
      targets: ".hero-glow-dot",
      scale: [1, 1.55, 1],
      opacity: [0.28, 0.75, 0.28],
      duration: 2900,
      loop: true,
      easing: "easeInOutSine",
      delay: anime.stagger(720),
    });

    return () => tl.pause();
  }, []);

  /* ── Cursor glow (lerp follower) ── */
  useEffect(() => {
    const container = containerRef.current;
    const cursor = cursorRef.current;
    if (!container || !cursor) return;

    let mouseX = 0,
      mouseY = 0,
      curX = 0,
      curY = 0,
      rafId;

    const lerp = (a, b, t) => a + (b - a) * t;

    const onMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const tick = () => {
      curX = lerp(curX, mouseX, 0.1);
      curY = lerp(curY, mouseY, 0.1);
      cursor.style.left = `${curX}px`;
      cursor.style.top = `${curY}px`;
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
      className="relative min-h-[540px] overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-[#1a2842] via-[#0f172a] to-[#0b1220] p-8 lg:p-12"
    >
      {/* Cursor glow blob */}
      <div
        ref={cursorRef}
        className="pointer-events-none absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#CFAE70] blur-3xl"
        style={{ left: "50%", top: "50%", opacity: "0.05" }}
      />

      {/* ── SVG grid ── */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line
            key={`h${i}`}
            className="hero-grid-h"
            x1="0"
            y1={`${i * 14.28}%`}
            x2="100%"
            y2={`${i * 14.28}%`}
            stroke="#CFAE70"
            strokeWidth="0.5"
            style={{ opacity: 0 }}
          />
        ))}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <line
            key={`v${i}`}
            className="hero-grid-v"
            x1={`${i * 9.09}%`}
            y1="0"
            x2={`${i * 9.09}%`}
            y2="100%"
            stroke="#CFAE70"
            strokeWidth="0.5"
            style={{ opacity: 0 }}
          />
        ))}
        <line
          className="hero-diagonal"
          x1="0"
          y1="100%"
          x2="34%"
          y2="0"
          stroke="#CFAE70"
          strokeWidth="0.9"
          style={{ opacity: 0 }}
        />
        <line
          className="hero-diagonal"
          x1="66%"
          y1="100%"
          x2="100%"
          y2="0"
          stroke="#CFAE70"
          strokeWidth="0.9"
          style={{ opacity: 0 }}
        />

        {/* Accent dots */}
        <circle
          className="hero-glow-dot"
          cx="82%"
          cy="57%"
          r="3"
          fill="#CFAE70"
          style={{ opacity: 0.28 }}
        />
        <circle
          className="hero-glow-dot"
          cx="75%"
          cy="27%"
          r="2"
          fill="#CFAE70"
          style={{ opacity: 0.22 }}
        />
        <circle
          className="hero-glow-dot"
          cx="91%"
          cy="75%"
          r="2.5"
          fill="#CFAE70"
          style={{ opacity: 0.2 }}
        />
      </svg>

      {/* ── Decorative rings (desktop) ── */}
      <div
        className="pointer-events-none absolute right-16 top-1/2 hidden lg:block"
        style={{ transform: "translateY(-50%)" }}
      >
        <div className="relative" style={{ width: 200, height: 200 }}>
          <div
            className="hero-ring-outer absolute rounded-full border border-dashed border-[#CFAE70]/20"
            style={{ inset: 0 }}
          />
          <div
            className="hero-ring-inner absolute rounded-full border border-dashed border-[#CFAE70]/15"
            style={{ top: 40, left: 40, right: 40, bottom: 40 }}
          />
          <div
            className="absolute rounded-full bg-[#CFAE70]/40"
            style={{
              width: 8,
              height: 8,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          />
        </div>
      </div>

      {/* ── Floating particles ── */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="shop-particle pointer-events-none absolute rounded-full bg-[#CFAE70]"
          style={{
            left: p.x,
            top: p.y,
            width: p.s,
            height: p.s,
            opacity: 0.3,
          }}
        />
      ))}

      {/* ── Content ── */}
      <div className="relative z-10 max-w-xl">
        {/* Badge */}
        <p
          className="hero-badge inline-flex items-center gap-2 rounded-full border border-[#CFAE70]/50 bg-[#CFAE70]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#CFAE70]"
          style={{ opacity: 0 }}
        >
          <span aria-hidden="true">✦</span> Colección 2026
        </p>

        {/* Title */}
        <h1 className="mt-5 text-4xl font-black leading-tight text-slate-100 md:text-5xl lg:text-6xl">
          {HERO_WORDS.map((word, i) => (
            <span
              key={i}
              className="hero-word mr-[0.28em] inline-block"
              style={{ opacity: 0 }}
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="mt-5 max-w-lg text-base leading-relaxed text-slate-300"
          style={{ opacity: 0 }}
        >
          Tienda premium con stock en tiempo real, checkout seguro y seguimiento
          completo de tu pedido.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-3">
          <div className="hero-cta" style={{ opacity: 0 }}>
            <Button onClick={() => navigate("/tienda/catalogo")}>
              Explorar catálogo
            </Button>
          </div>
          <div className="hero-cta" style={{ opacity: 0 }}>
            <Button
              variant="ghost"
              onClick={() => navigate("/tienda/tracking")}
            >
              Ver tracking
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-10 flex gap-8 border-t border-slate-700/50 pt-6">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="hero-stat-item"
              style={{ opacity: 0 }}
            >
              <p
                className="stat-num text-2xl font-black text-[#CFAE70]"
                data-value={stat.value}
                data-suffix={stat.suffix}
              >
                0
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShopHero;
