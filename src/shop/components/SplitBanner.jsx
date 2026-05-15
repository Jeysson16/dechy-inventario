import { useNavigate } from "react-router-dom";

const SplitBanner = ({
  badge = "Oferta especial",
  headline = "Paneles decorativos\nhasta 25% OFF",
  subtext = "Transforma cualquier espacio con nuestros paneles 3D. Fácil instalación, múltiples diseños.",
  cta = "Shop Now",
  ctaLink = "/tienda/catalogo",
  image = "/img/banners/split/deco2.png",
  accent = "#CFAE70",
  reverse = false,
}) => {
  const navigate = useNavigate();

  return (
    <section
      className={`grid md:grid-cols-2 rounded-2xl overflow-hidden bg-[#0F172A] min-h-[280px]`}
    >
      {/* Text column */}
      <div
        className={`flex flex-col justify-center p-8 sm:p-12 ${reverse ? "md:order-2" : ""}`}
      >
        <span
          className="inline-flex self-start items-center text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5 border"
          style={{
            background: `${accent}22`,
            color: accent,
            borderColor: `${accent}44`,
          }}
        >
          ✦ {badge}
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-4 whitespace-pre-line">
          {headline}
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-8 max-w-sm">
          {subtext}
        </p>
        <button
          onClick={() => navigate(ctaLink)}
          className="self-start font-bold text-sm px-6 py-3 rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
          style={{ background: accent, color: "#0F172A" }}
        >
          {cta} →
        </button>
      </div>

      {/* Image column */}
      <div
        className={`relative min-h-[220px] ${reverse ? "md:order-1" : ""} bg-slate-800`}
      >
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div
          className={`absolute inset-0 ${
            reverse
              ? "bg-gradient-to-r from-transparent to-[#0F172A]/40"
              : "bg-gradient-to-l from-transparent to-[#0F172A]/40"
          }`}
        />
      </div>
    </section>
  );
};

export default SplitBanner;
