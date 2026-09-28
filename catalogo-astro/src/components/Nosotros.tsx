import React from 'react';
import { Truck, Package, MessageSquare, FileText, ShieldCheck, Handshake, HeartHandshake, CheckCircle2 } from 'lucide-react';

interface NosotrosProps {
  primaryColor: string;
  bannerImage?: string;
  onGoToCatalog: () => void;
}

export const Nosotros: React.FC<NosotrosProps> = ({ primaryColor, bannerImage, onGoToCatalog }) => {
  return (
    <>
      {/* ══════════════════════════════════════
           Banner de página
         ══════════════════════════════════════ */}
      <div className="relative py-16 px-6 bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={bannerImage || '/img/hero_lifestyle_bg.png'} className="w-full h-full object-cover opacity-25 filter blur-sm scale-105" alt="" />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span>Inicio</span>
            <span className="opacity-60">/</span>
            <span style={{ color: primaryColor }} className="font-semibold">Nosotros</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight max-w-xl">
            Detrás de cada material, <span className="italic" style={{ color: primaryColor }}>una historia</span>
          </h1>
        </div>
      </div>

      {/* ══════════════════════════════════════
           Quiénes somos
         ══════════════════════════════════════ */}
      <section className="py-16 px-6 bg-white dark:bg-[#0c0c0e]">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div className="rounded-3xl overflow-hidden aspect-[4/3] shadow-lg">
            <img src={bannerImage || '/img/hero_lifestyle_bg.png'} className="w-full h-full object-cover" alt="Ambientes Dechy" />
          </div>
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">Quiénes somos</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-slate-950 dark:text-white font-normal">
              Especialistas en materiales que transforman ambientes
            </h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 font-light">
              En Dechy seleccionamos wall panels, pisos SPC y placas UV de mármol pensando en cómo se ven y se comportan en la obra real, no solo en el catálogo. Trabajamos junto a arquitectos, diseñadores y dueños de casa para que cada ambiente combine estética, durabilidad y un proceso de compra simple, desde la asesoría inicial hasta la entrega.
            </p>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 font-light">
              Cada producto de nuestro catálogo pasa por nuestras propias sucursales antes de llegar a tu proyecto, para que compres con la confianza de ver stock real y precios claros.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           Misión / Visión
         ══════════════════════════════════════ */}
      <section className="py-16 px-6 bg-slate-50 dark:bg-[#09090b]">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl p-8 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 space-y-3 shadow-sm">
            <Handshake className="w-6 h-6" style={{ color: primaryColor }} />
            <h3 className="text-xl font-serif text-slate-950 dark:text-white font-semibold">Misión</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-light">
              Acercar materiales decorativos de calidad profesional a cualquier proyecto, grande o pequeño, con asesoría clara y stock real.
            </p>
          </div>
          <div className="rounded-3xl p-8 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-white/5 space-y-3 shadow-sm">
            <ShieldCheck className="w-6 h-6" style={{ color: primaryColor }} />
            <h3 className="text-xl font-serif text-slate-950 dark:text-white font-semibold">Visión</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-light">
              Ser el catálogo de referencia en revestimientos y acabados decorativos, reconocido por la calidad de sus materiales.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           Nuestros valores
         ══════════════════════════════════════ */}
      <section className="py-16 px-6 bg-white dark:bg-[#0c0c0e]">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">Lo que nos define</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-slate-950 dark:text-white font-normal">Nuestros valores</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center gap-2.5">
              <ShieldCheck className="w-6 h-6" style={{ color: primaryColor }} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">Calidad</h4>
              <p className="text-[11.5px] text-slate-400 leading-relaxed font-light">Materiales certificados y probados antes de entrar al catálogo.</p>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <Handshake className="w-6 h-6" style={{ color: primaryColor }} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">Confianza</h4>
              <p className="text-[11.5px] text-slate-400 leading-relaxed font-light">Precios claros y stock real, sin sorpresas al momento de comprar.</p>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <HeartHandshake className="w-6 h-6" style={{ color: primaryColor }} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">Cercanía</h4>
              <p className="text-[11.5px] text-slate-400 leading-relaxed font-light">Asesoría real antes, durante y después de la compra.</p>
            </div>
            <div className="flex flex-col items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6" style={{ color: primaryColor }} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">Compromiso</h4>
              <p className="text-[11.5px] text-slate-400 leading-relaxed font-light">Acompañamos cada proyecto hasta que el espacio queda listo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           Por qué elegirnos
         ══════════════════════════════════════ */}
      <section className="py-10 px-6 bg-slate-50 dark:bg-[#08080a] border-y border-slate-200/40 dark:border-slate-850">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
              <Truck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Envíos a todo el país</h4>
              <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Llegamos hasta tu proyecto o almacén.</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
              <Package className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Productos de calidad</h4>
              <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Materiales certificados, resistentes y duraderos.</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
              <MessageSquare className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Asesoría experta</h4>
              <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Te ayudamos a definir el material ideal para tu stock.</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Catálogo de muestras</h4>
              <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Pide tus muestras físicas y elige con seguridad.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           CTA final
         ══════════════════════════════════════ */}
      <section className="py-20 px-6 bg-white dark:bg-[#0c0c0e] text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-2xl sm:text-3xl font-serif text-slate-950 dark:text-white font-normal">
            ¿Listo para transformar tu espacio?
          </h2>
          <button
            onClick={onGoToCatalog}
            className="px-7 py-3 text-[10px] font-bold uppercase tracking-wider text-white rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            Ver Catálogo
          </button>
        </div>
      </section>
    </>
  );
};
