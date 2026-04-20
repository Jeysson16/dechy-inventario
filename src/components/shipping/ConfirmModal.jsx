import { motion as Motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

const ConfirmModal = ({
  open,
  onClose,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isLoading = false,
  isDangerous = false,
  confirmClassName = "",
  cancelClassName = "",
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <Motion.div
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                {isDangerous && (
                  <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className={`flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50 ${cancelClassName}`}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-50 ${
                  isDangerous
                    ? "bg-rose-500 hover:bg-rose-600"
                    : "bg-primary hover:bg-primary/90"
                } ${confirmClassName}`}
              >
                {isLoading ? "Procesando..." : confirmText}
              </button>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
