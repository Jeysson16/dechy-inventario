import { motion } from "framer-motion";

const variants = {
  primary:
    "shop-accent-bg text-slate-900 hover:brightness-105 focus-visible:ring-primary/40",
  ghost:
    "bg-transparent text-slate-100 border border-slate-600 hover:bg-slate-700/50 focus-visible:ring-slate-400/30",
  dark: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-500/30",
};

const Button = ({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) => {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default Button;
