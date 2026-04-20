import { motion } from "framer-motion";
import { CheckCheck } from "lucide-react";

import { SHIPPING_STEPS, getTimelineIndex } from "../../utils/shipping";

const Timeline = ({ status }) => {
  const activeIndex = getTimelineIndex(status);

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {SHIPPING_STEPS.map((step, index) => {
        const completed = index < activeIndex;
        const active = index === activeIndex;

        return (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`relative rounded-3xl border px-4 py-5 transition-all ${
              active
                ? "border-primary/30 bg-primary/10 shadow-lg shadow-primary/10"
                : completed
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div
                className={`flex size-10 items-center justify-center rounded-2xl ${
                  active
                    ? "bg-primary text-white"
                    : completed
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                }`}
              >
                {completed ? (
                  <CheckCheck className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-black">{index + 1}</span>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Paso {index + 1}
              </span>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {step}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {active
                ? "Etapa actual del contenedor"
                : completed
                  ? "Etapa completada"
                  : "Pendiente por alcanzar"}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default Timeline;
