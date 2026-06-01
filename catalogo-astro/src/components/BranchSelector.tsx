import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, ChevronDown, Check } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  location: string;
  configuracion?: {
    logo?: string;
    colores?: {
      primario?: string;
      secundario?: string;
    };
  };
}

interface BranchSelectorProps {
  branches: Branch[];
  selectedBranch: Branch | null;
  onSelectBranch: (branch: Branch) => void;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ branches, selectedBranch, onSelectBranch }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-all group"
      >
        <div className="flex items-center gap-2">
          {selectedBranch?.configuracion?.logo ? (
            <img 
              src={selectedBranch.configuracion.logo} 
              alt={selectedBranch.name} 
              className="w-8 h-8 rounded-full object-cover bg-white p-0.5"
            />
          ) : (
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: selectedBranch?.configuracion?.colores?.primario || '#3b82f6' }}
            >
              <Store className="w-4 h-4" />
            </div>
          )}
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
            {selectedBranch ? selectedBranch.name : (branches[0]?.name || 'Jieda')}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-3 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto p-2">
              {branches.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">Cargando sucursales...</div>
              ) : (
                branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      onSelectBranch(branch);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      selectedBranch?.id === branch.id
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {branch.configuracion?.logo ? (
                        <img 
                          src={branch.configuracion.logo} 
                          alt={branch.name} 
                          className="w-8 h-8 rounded-full object-cover bg-white"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: branch.configuracion?.colores?.primario || '#3b82f6' }}
                        >
                          <Store className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-sm" style={{ color: selectedBranch?.id === branch.id ? (branch.configuracion?.colores?.primario || '') : '' }}>
                          {branch.name}
                        </span>
                      </div>
                    </div>
                    {selectedBranch?.id === branch.id && (
                      <Check 
                        className="w-4 h-4" 
                        style={{ color: branch.configuracion?.colores?.primario || '#3b82f6' }} 
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
