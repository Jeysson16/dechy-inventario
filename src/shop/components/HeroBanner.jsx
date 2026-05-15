import { useNavigate } from "react-router-dom";

const HeroBanner = ({
  badge = "Temporada 2026",
  headline = "Cielo Raso Modular\npara tu hogar",
  subtext = "Diseño elegante para espacios modernos. Fácil instalación, acabado premium.",
  cta = "Ver colección",
  ctaLink = "/tienda/catalogo",
  image = "/img/banners/promo/deco1.jpg",
}) => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#0F172A] min-h-[300px] sm:min-h-[360px]">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/85 via-[#0F172A]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/40 via-transparent to-transparent" />

      <div className="relative z-10 flex items-center min-h-[300px] sm:min-h-[360px] px-8 sm:px-14 py-12">
        <div className="max-w-lg">
          <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5 bg-[#CFAE70]/20 text-[#CFAE70] border border-[#CFAE70]/30">
            ✦ {badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4 whitespace-pre-line">
            {headline}
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-md">
            {subtext}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate(ctaLink)}
              className="btn-accent text-sm"
            >
              {cta}
            </button>
            <button
              onClick={() => navigate("/tienda/catalogo")}
              className="btn-outline text-sm"
              style={{ color: "white", borderColor: "rgba(255,255,255,0.4)" }}
            >
              Ver catálogo
            </button>
          </div>
        </div>
      </div>

      {/* Decorative accent strip */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 opacity-60"
        style={{ background: "linear-gradient(90deg, #CFAE70, transparent)" }}
      />
    </section>
  );
};

export default HeroBanner;
