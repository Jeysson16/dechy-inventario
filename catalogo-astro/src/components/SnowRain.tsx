import type { CSSProperties } from 'react';

// Lluvia de nieve decorativa para Navidad en el catálogo público.
// Es solo visual: no bloquea clics (pointer-events: none) y se oculta
// si el visitante tiene activado "reducir movimiento" en su sistema.

const FLAKE_COUNT = 45;

// Temporada: activa desde ya hasta la llegada del Año Nuevo 2027 (31 de diciembre de 2026 inclusive).
const SEASON_END = new Date(2027, 0, 1);
const isChristmasSeason = (date = new Date()) => date < SEASON_END;

const Flake = () => (
  <svg viewBox="-12 -12 24 24" className="snow-rain__svg" aria-hidden="true">
    {[0, 60, 120].map((deg) => (
      <g key={deg} transform={`rotate(${deg})`}>
        <line x1="0" y1="-10" x2="0" y2="10" />
        <polyline points="-3,-8 0,-5 3,-8" />
        <polyline points="-3,8 0,5 3,8" />
      </g>
    ))}
  </svg>
);

const FLAKES = Array.from({ length: FLAKE_COUNT }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  // Mezcla de copos dibujados y puntos de nieve sencillos.
  shape: Math.random() < 0.4 ? 'flake' : 'dot',
  size: 6 + Math.random() * 16,
  fall: 8 + Math.random() * 12,
  delay: -Math.random() * 20,
  sway: 15 + Math.random() * 45,
  spin: 4 + Math.random() * 8,
  opacity: 0.5 + Math.random() * 0.45,
  drift: (Math.random() - 0.5) * 120,
}));

const vars = (v: Record<string, string>) => v as CSSProperties;

export const SnowRain = () => {
  if (!isChristmasSeason()) return null;

  return (
    <div className="snow-rain" aria-hidden="true">
      <style>{`
        .snow-rain { position: fixed; inset: 0; z-index: 60; pointer-events: none; overflow: hidden; }
        .snow-rain__flake {
          position: absolute; top: -40px;
          animation-name: snow-rain-fall; animation-timing-function: linear; animation-iteration-count: infinite;
        }
        .snow-rain__sway { animation: snow-rain-sway 3.2s ease-in-out infinite alternate; }
        .snow-rain__spin { animation: snow-rain-spin var(--spin) linear infinite; }
        .snow-rain__svg {
          display: block; width: 100%; height: auto; overflow: visible;
          fill: none; stroke: #ffffff; stroke-width: 1.8; stroke-linecap: round;
          filter: drop-shadow(0 0 2px rgba(147, 197, 253, 0.9)) drop-shadow(0 1px 2px rgba(30, 41, 90, 0.35));
        }
        .snow-rain__dot {
          width: 100%; aspect-ratio: 1; border-radius: 50%; background: #ffffff;
          box-shadow: 0 0 4px rgba(147, 197, 253, 0.9), 0 1px 2px rgba(30, 41, 90, 0.3);
        }
        @keyframes snow-rain-fall {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(var(--drift), calc(100vh + 80px), 0); }
        }
        @keyframes snow-rain-sway {
          from { transform: translateX(calc(var(--sway) * -1)); }
          to   { transform: translateX(var(--sway)); }
        }
        @keyframes snow-rain-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) { .snow-rain { display: none; } }
      `}</style>
      {FLAKES.map((f) => (
        <div
          key={f.id}
          className="snow-rain__flake"
          style={{
            left: `${f.left}%`,
            width: f.shape === 'dot' ? f.size * 0.45 : f.size,
            opacity: f.opacity,
            animationDuration: `${f.fall}s`,
            animationDelay: `${f.delay}s`,
            ...vars({ '--drift': `${f.drift}px` }),
          }}
        >
          <div
            className="snow-rain__sway"
            style={{ animationDelay: `${f.delay}s`, ...vars({ '--sway': `${f.sway}px` }) }}
          >
            {f.shape === 'dot' ? (
              <div className="snow-rain__dot" />
            ) : (
              <div className="snow-rain__spin" style={vars({ '--spin': `${f.spin}s` })}>
                <Flake />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
