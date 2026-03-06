import { useEffect, useMemo, useState } from 'react';

/**
 * Generic DataTable component
 * @param {Array} data - Array of objects to display
 * @param {Array} columns - Array of column definitions { key, label, render, sortable }
 * @param {Object} actions - Actions to display (view, edit, delete, etc.)
 * @param {string} searchPlaceholder - Placeholder for the search input
 * @param {number} pageSize - Number of items per page
 * @param {string} emptyMessage - Message to show when no data
 * @param {boolean} loading - Loading state
 */
const DataTable = ({ 
  data = [], 
  columns = [], 
  actions = [], 
  searchPlaceholder = 'Buscar...',
  pageSize = 10,
  emptyMessage = 'No se encontraron resultados.',
  loading = false,
  onRowClick,
  headerContent,
  children // Optional: to render a Grid or custom view while keeping the toolbar
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Reset pagination on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredData = useMemo(() => {
    let result = [...data];
    
    // Search Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => {
        return Object.values(item).some(val => 
          String(val).toLowerCase().includes(lowerSearch)
        );
      });
    }

    // Sorting Logic
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Close menu on click outside
  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Premium Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-1">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          {/* Search Input with Premium Styling */}
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-lg transition-opacity opacity-0 group-focus-within:opacity-100 pointer-events-none"></div>
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
              <span 
                className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-[22px]"
              >
                search
              </span>
            </div>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-12 pr-4 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm shadow-slate-200/50 dark:shadow-none placeholder:text-slate-400 flex items-center"
            />
          </div>

          {/* Records count badge */}
          <div className="hidden sm:flex items-center gap-2 px-4 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="size-2 rounded-full bg-primary"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
              {filteredData.length} registros
            </span>
          </div>
        </div>

        {/* Dynamic header content (filters, buttons, etc) */}
        {headerContent && (
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            {headerContent}
          </div>
        )}
      </div>

      {children ? (
        /* If custom content is provided, we pass the filtered data to it if it's a function */
        <div className="flex flex-col gap-6">
          {typeof children === 'function' ? children(filteredData) : children}
        </div>
      ) : (
        /* Default Table View */
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative group transition-all duration-500 hover:shadow-primary/5">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/50">

                  {columns.map(col => (
                    <th 
                      key={col.key} 
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      className={`px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ${col.sortable !== false ? 'cursor-pointer hover:text-primary transition-colors' : ''} ${col.className || ''}`}
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {col.sortable !== false && sortConfig.key === col.key && (
                          <span className="material-symbols-outlined text-[14px]">
                            {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  {actions.length > 0 && (
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] text-right">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      {columns.map(col => (
                        <td key={col.key} className="px-8 py-5">
                          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-full"></div>
                        </td>
                      ))}
                      {actions.length > 0 && <td className="px-8 py-5"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-12 ml-auto"></div></td>}
                    </tr>
                  ))
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((item, index) => (
                    <tr 
                      key={item.id || index}
                      onClick={() => onRowClick?.(item)}
                      className={`group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative overflow-hidden ${onRowClick ? 'cursor-pointer' : ''}`}
                    >
                      {columns.map(col => (
                        <td key={col.key} className={`px-8 py-5 transition-all ${col.className || ''}`}>
                          {col.render ? col.render(item[col.key], item) : (item[col.key] || 'N/A')}
                        </td>
                      ))}
                      
                      {/* Actions Column */}
                      {actions.length > 0 && (
                        <td className="px-8 py-5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {/* Desktop Actions */}
                          <div className="hidden md:flex justify-end items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            {actions.map((action, i) => (
                              <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); action.onClick(item); }}
                                className={`size-9 flex items-center justify-center rounded-xl transition-all ${action.className || 'text-slate-500 hover:text-primary hover:bg-primary/10 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                                title={action.label}
                              >
                                <span className="material-symbols-outlined text-[19px]">{action.icon}</span>
                              </button>
                            ))}
                          </div>

                          {/* Mobile Actions Menu */}
                          <div className="md:hidden relative inline-block text-left">
                            <button
                              onClick={(e) => toggleMenu(item.id, e)}
                              className="size-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                            >
                              <span className="material-symbols-outlined">more_vert</span>
                            </button>
                            
                            {openMenuId === item.id && (
                              <div
                                className="absolute right-0 bottom-full mb-3 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 py-2.5 overflow-hidden"
                              >
                                {actions.map((action, i) => (
                                  <button
                                    key={i}
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      action.onClick(item); 
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-4 px-5 py-3 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary transition-all text-left font-bold"
                                  >
                                    <span className="material-symbols-outlined text-[20px] opacity-60">{action.icon}</span>
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <div className="size-20 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-5 border border-slate-100 dark:border-slate-800">
                          <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                        </div>
                        <p className="font-bold text-slate-500 dark:text-slate-400">{emptyMessage}</p>
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="mt-4 text-xs font-black text-primary uppercase tracking-widest hover:underline"
                        >
                          Limpiar Búsqueda
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Premium Pagination */}
          {totalPages > 1 && (
            <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-6 flex-wrap">
              <div className="text-sm text-slate-400 font-bold uppercase tracking-wider">
                Página <span className="text-slate-900 dark:text-white">{currentPage}</span> de <span className="text-slate-900 dark:text-white">{totalPages}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="size-11 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm active:scale-90"
                >
                  <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                </button>
                
                <div className="hidden sm:flex items-center gap-1.5 px-1.5 py-1.5 bg-slate-200/50 dark:bg-slate-800 rounded-[20px] border border-slate-200/30 dark:border-slate-700/50">
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                      if (pageNum < 1) pageNum = i + 1;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`size-9 rounded-[14px] text-xs font-black transition-all ${currentPage === pageNum ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-500 hover:text-primary'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="size-11 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm active:scale-90"
                >
                  <span className="material-symbols-outlined text-[24px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
