import { motion } from "framer-motion";

import { STATUS_META, clamp } from "../../utils/shipping";

const ProgressBar = ({ progress, status, showLabel = true }) => {
  const safeProgress = clamp(progress ?? 0, 0, 100);
  const meta = STATUS_META[status] || STATUS_META["En tránsito"];

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
          <span>Progreso logístico</span>
          <span className="text-slate-600 dark:text-slate-300">
            {Math.round(safeProgress)}%
          </span>
        </div>
      )}
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safeProgress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${meta.bar}`}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
