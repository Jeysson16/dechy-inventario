const tones = {
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  neutral: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
};

const Badge = ({ tone = "neutral", children, className = "" }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
