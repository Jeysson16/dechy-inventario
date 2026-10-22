import type { CSSProperties } from 'react';

// Lluvia de murciélagos decorativa para Halloween en el catálogo público.
// Es solo visual: no bloquea clics (pointer-events: none) y se oculta
// si el visitante tiene activado "reducir movimiento" en su sistema.

const BAT_COUNT = 22;

// Temporada: del 1 de octubre al 2 de noviembre. Fuera de esas fechas no se muestra.
const isHalloweenSeason = (date = new Date()) => {
  const month = date.getMonth();
  return month === 9 || (month === 10 && date.getDate() <= 2);
};

const WING =
  'M0,-2 C-12,-16 -38,-22 -58,-12 C-50,-8 -47,0 -48,8 C-41,2 -34,3 -31,10 C-25,4 -18,5 -15,12 C-10,8 -5,8 0,12 Z';

const Bat = () => (
  <svg viewBox="-60 -26 120 44" className="bat-rain__svg" aria-hidden="true">
    <g className="bat-rain__wing bat-rain__wing--left">
      <path d={WING} />
    </g>
    <g className="bat-rain__wing bat-rain__wing--right">
      <path d={WING} transform="scale(-1,1)" />
    </g>
    <path d="M0,-10 C7,-20 12,-20 14,-12 L18,-24 L20,-6 C14,10 6,16 0,18 C-6,16 -14,10 -20,-6 L-18,-24 L-14,-12 C-12,-20 -7,-20 0,-10 Z" />
    <circle cx="-5" cy="-6" r="2.4" className="bat-rain__eye" />
    <circle cx="5" cy="-6" r="2.4" className="bat-rain__eye" />
  </svg>
);

const BATS = Array.from({ length: BAT_COUNT }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  size: 18 + Math.random() * 30,
  fall: 9 + Math.random() * 10,
  delay: -Math.random() * 19,
  sway: 25 + Math.random() * 70,
  flap: 0.18 + Math.random() * 0.2,
  opacity: 0.35 + Math.random() * 0.45,
  drift: (Math.random() - 0.5) * 160,
}));

const vars = (v: Record<string, string>) => v as CSSProperties;

export const BatRain = () => {
  if (!isHalloweenSeason()) return null;

  return (
    <div className="bat-rain" aria-hidden="true">
      <style>{`
        .bat-rain { position: fixed; inset: 0; z-index: 60; pointer-events: none; overflow: hidden; }
        .bat-rain__bat {
          position: absolute; top: -60px;
          animation-name: bat-rain-fall; animation-timing-function: linear; animation-iteration-count: infinite;
        }
        .bat-rain__sway { animation: bat-rain-sway 2.6s ease-in-out infinite alternate; }
        .bat-rain__svg {
          display: block; width: 100%; height: auto; fill: #7c3aed; overflow: visible;
          filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.55)) drop-shadow(0 2px 3px rgba(30, 10, 60, 0.35));
        }
        .bat-rain__eye { fill: #fbbf24; }
        .bat-rain__wing { transform-box: fill-box; animation: bat-rain-flap var(--flap) ease-in-out infinite alternate; }
        .bat-rain__wing--left { transform-origin: right center; }
        .bat-rain__wing--right { transform-origin: left center; }
        @keyframes bat-rain-fall {
          0%   { transform: translate3d(0, 0, 0) rotate(-8deg); }
          100% { transform: translate3d(var(--drift), calc(100vh + 120px), 0) rotate(8deg); }
        }
        @keyframes bat-rain-sway {
          from { transform: translateX(calc(var(--sway) * -1)); }
          to   { transform: translateX(var(--sway)); }
        }
        @keyframes bat-rain-flap {
          from { transform: scaleY(1); }
          to   { transform: scaleY(0.25); }
        }
        @media (prefers-reduced-motion: reduce) { .bat-rain { display: none; } }
      `}</style>
      {BATS.map((b) => (
        <div
          key={b.id}
          className="bat-rain__bat"
          style={{
            left: `${b.left}%`,
            width: b.size,
            opacity: b.opacity,
            animationDuration: `${b.fall}s`,
            animationDelay: `${b.delay}s`,
            ...vars({ '--drift': `${b.drift}px` }),
          }}
        >
          <div
            className="bat-rain__sway"
            style={{ animationDelay: `${b.delay}s`, ...vars({ '--sway': `${b.sway}px` }) }}
          >
            <div style={vars({ '--flap': `${b.flap}s` })}>
              <Bat />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
