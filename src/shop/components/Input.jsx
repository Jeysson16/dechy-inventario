const Input = ({ className = "", ...props }) => {
  return (
    <input
      className={`w-full rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-[#CFAE70] focus:ring-2 focus:ring-[#CFAE70]/20 ${className}`}
      {...props}
    />
  );
};

export default Input;
