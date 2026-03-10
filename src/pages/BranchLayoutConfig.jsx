import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../config/supabaseClient';

const BranchLayoutConfig = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState(null);
  
  // Layouts State
  const [layouts, setLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false); // For creating new layout
  const [newLayoutName, setNewLayoutName] = useState('');

  // Grid config state (derived from current layout)
  const [numShelves, setNumShelves] = useState(3);
  const [numShelvesInput, setNumShelvesInput] = useState('3');
  const [uniformRows, setUniformRows] = useState(true);
  const [defaultRows, setDefaultRows] = useState(4);
  const [defaultRowsInput, setDefaultRowsInput] = useState('4');
  const [shelves, setShelves] = useState([]);
  const [customAreaNames, setCustomAreaNames] = useState({});

  // Modal State (Area Rename)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          toast.error('Empresa no encontrada');
          navigate('/sucursales');
          return;
        }

        setBranch(data);
        
        let loadedLayouts = [];
        // Supabase: layouts are inside 'settings' JSONB column
        if (data.settings && data.settings.layouts && Array.isArray(data.settings.layouts) && data.settings.layouts.length > 0) {
          loadedLayouts = data.settings.layouts;
        } else if (data.settings && data.settings.layout) {
          // Migration: Convert single layout to array
          loadedLayouts = [{
            id: 'main',
            name: 'Principal',
            ...data.settings.layout
          }];
        } else {
           // Default initial layout
           loadedLayouts = [{
             id: 'main',
             name: 'Principal',
             numShelves: 3,
             uniformRows: true,
             defaultRows: 4,
             shelves: Array.from({ length: 3 }, (_, i) => ({
              id: `shelf-${i + 1}`,
              name: `Estante ${i + 1}`,
              rows: 4,
              type: i === 0 || i === 2 ? 'single' : 'double',
             })),
             customAreaNames: {}
           }];
        }
        
        setLayouts(loadedLayouts);
        if (loadedLayouts.length > 0) {
           loadLayout(loadedLayouts[0]);
        }

      } catch (error) {
        console.error("Error fetching branch:", error);
        toast.error('Error al cargar la empresa');
      } finally {
        setLoading(false);
      }
    };
    fetchBranch();
  }, [id, navigate]);

  const loadLayout = (layout) => {
    setCurrentLayoutId(layout.id);
    setNumShelves(layout.numShelves || 3);
    setNumShelvesInput(String(layout.numShelves || 3));
    setUniformRows(layout.uniformRows !== undefined ? layout.uniformRows : true);
    setDefaultRows(layout.defaultRows || 4);
    setDefaultRowsInput(String(layout.defaultRows || 4));
    setCustomAreaNames(layout.customAreaNames || {});
    
    const loadedShelves = (layout.shelves || []).map(s => ({
      ...s,
      rowsInput: String(s.rows || 4)
    }));
    setShelves(loadedShelves.length > 0 ? loadedShelves : Array.from({ length: 3 }, (_, i) => ({
      id: `shelf-${i + 1}`,
      name: `Estante ${i + 1}`,
      rows: 4,
      rowsInput: '4',
      type: i === 0 || i === 2 ? 'single' : 'double',
    })));
  };

  const handleCreateLayout = () => {
    if (!newLayoutName.trim()) return;
    const newId = `layout-${Date.now()}`;
    const newLayout = {
      id: newId,
      name: newLayoutName.trim(),
      numShelves: 3,
      uniformRows: true,
      defaultRows: 4,
      shelves: Array.from({ length: 3 }, (_, i) => ({
        id: `shelf-${i + 1}`,
        name: `Estante ${i + 1}`,
        rows: 4,
        type: i === 0 || i === 2 ? 'single' : 'double',
      })),
      customAreaNames: {}
    };
    
    const updatedLayouts = [...layouts, newLayout];
    setLayouts(updatedLayouts);
    loadLayout(newLayout);
    setIsLayoutModalOpen(false);
    setNewLayoutName('');
    toast.success('Nuevo croquis creado');
    // Save immediately to persist the new layout structure
    saveLayoutsToDb(updatedLayouts);
  };

  const handleDeleteLayout = async (layoutId) => {
    if (layouts.length <= 1) {
      toast.error('Debe haber al menos un croquis');
      return;
    }
    if (!window.confirm('¿Está seguro de eliminar este croquis?')) return;
    
    const updatedLayouts = layouts.filter(l => l.id !== layoutId);
    setLayouts(updatedLayouts);
    
    if (currentLayoutId === layoutId) {
      loadLayout(updatedLayouts[0]);
    }
    
    await saveLayoutsToDb(updatedLayouts);
    toast.success('Croquis eliminado');
  };

  const saveLayoutsToDb = async (layoutsToSave) => {
      try {
        const { error } = await supabase
          .from('branches')
          .update({
            settings: { 
              ...branch.settings,
              layouts: layoutsToSave 
            }
          })
          .eq('id', id);

        if (error) throw error;
      } catch (error) {
        console.error("Error saving layouts:", error);
        throw error;
      }
  };


  const handleNumShelvesChange = (valStr) => {
    setNumShelvesInput(valStr);
    const val = parseInt(valStr);
    if (isNaN(val) || val < 1) return;
    
    // No limits as requested
    setNumShelves(val);
    
    // Adjust shelves array
    let newShelves = [...shelves];
    if (val > shelves.length) {
      for (let i = shelves.length; i < val; i++) {
          newShelves.push({
            id: `shelf-${i + 1}`,
            name: `Estante ${i + 1}`,
            rows: defaultRows,
            rowsInput: String(defaultRows),
            type: i === 0 || i === val - 1 ? 'single' : 'double'
          });
      }
    } else {
      newShelves = newShelves.slice(0, val);
    }
    
    // Re-evaluate if it's single/double roughly based on position
    if (newShelves.length > 1) {
        newShelves[0].type = 'single';
        newShelves[newShelves.length - 1].type = 'single';
    } else if (newShelves.length === 1) {
        newShelves[0].type = 'single';
    }
    
    setShelves(newShelves);
  };

  const handleUniformRowsChange = (e) => {
    const isUniform = e.target.checked;
    setUniformRows(isUniform);
    if (isUniform) {
      setShelves(shelves.map(s => ({ ...s, rows: defaultRows, rowsInput: String(defaultRows) })));
    }
  };

  const handleDefaultRowsChange = (valStr) => {
    setDefaultRowsInput(valStr);
    const val = parseInt(valStr);
    if (isNaN(val) || val < 1) return;
    
    setDefaultRows(val);
    if (uniformRows) {
      setShelves(shelves.map(s => ({ ...s, rows: val, rowsInput: String(val) })));
    }
  };

  const handleShelfChange = (index, field, value) => {
    const newShelves = [...shelves];
    if (field === 'rows') {
      newShelves[index].rowsInput = value;
      const parsed = parseInt(value);
      if (!isNaN(parsed) && parsed > 0) {
        newShelves[index].rows = parsed;
      }
    } else {
      newShelves[index][field] = value;
    }
    setShelves(newShelves);
  };

  const handleAreaClick = (shelfIdx, rowIdx, col) => {
    const key = `${shelfIdx}-${rowIdx}-${col}`;
    const defaultName = `${shelfIdx + 1}${col}${rowIdx + 1}`;
    const currentName = customAreaNames[key] || defaultName;
    
    setEditingArea({ key, shelfIdx, rowIdx, col, currentName });
    setNewName(currentName);
    setIsModalOpen(true);
  };

  const handleSaveName = () => {
    if (!editingArea) return;
    const { key } = editingArea;
    
    if (newName.trim() !== '') {
      setCustomAreaNames(prev => ({
        ...prev,
        [key]: newName.trim()
      }));
    } else {
       const updated = { ...customAreaNames };
       delete updated[key];
       setCustomAreaNames(updated);
    }
    setIsModalOpen(false);
    setEditingArea(null);
  };

  const handleSave = async () => {
    try {
      const updatedLayout = {
        id: currentLayoutId,
        name: layouts.find(l => l.id === currentLayoutId)?.name || 'Croquis',
        numShelves,
        uniformRows,
        defaultRows,
        shelves,
        customAreaNames
      };

      const updatedLayouts = layouts.map(l => l.id === currentLayoutId ? updatedLayout : l);
      
      await saveLayoutsToDb(updatedLayouts);
      toast.success('Croquis guardado correctamente');
      navigate('/sucursales');
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error('Error al guardar el croquis');
    }
  };

  const switchLayout = (layout) => {
    // Save current changes to state before switching?
    // For simplicity, we might lose unsaved changes if we don't save to the layouts array in state first.
    // Let's update the layouts array in state with current values before switching.
    const currentUpdated = {
        id: currentLayoutId,
        name: layouts.find(l => l.id === currentLayoutId)?.name,
        numShelves,
        uniformRows,
        defaultRows,
        shelves,
        customAreaNames
    };
    
    const newLayouts = layouts.map(l => l.id === currentLayoutId ? currentUpdated : l);
    setLayouts(newLayouts);
    
    loadLayout(layout);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 py-6 px-4 lg:px-8 animate-fadeIn w-full overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/sucursales')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Configurador de Croquis</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Empresa: {branch?.name}</p>
          </div>
          <div className="ml-auto flex gap-3">
             <button onClick={() => setIsLayoutModalOpen(true)} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Nuevo Croquis</span>
            </button>
             <button onClick={handleSave} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
              <span className="material-symbols-outlined text-sm">save</span>
              <span>Guardar y Salir</span>
            </button>
          </div>
        </div>

        {/* Layout Tabs */}
        {layouts.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
            {layouts.map(l => (
              <div 
                key={l.id}
                onClick={() => switchLayout(l)}
                className={`group flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border transition-all whitespace-nowrap ${
                  currentLayoutId === l.id 
                  ? 'bg-primary/10 border-primary/20 text-primary font-bold' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span>{l.name}</span>
                {layouts.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteLayout(l.id); }}
                    className="p-0.5 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 h-full flex-1 min-h-0">
          
          {/* Settings Panel */}
          <div className="lg:w-80 shrink-0 space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">settings</span>
                Configuración General
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Cantidad de Estantes</label>
                  <input 
                    type="number" 
                    min="1"
                    value={numShelvesInput}
                    onChange={(e) => handleNumShelvesChange(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all" 
                  />
                </div>

                <div className="flex items-center gap-3 py-2 border-t border-b border-slate-100 dark:border-slate-800/50">
                  <input 
                    type="checkbox" 
                    id="uniformRows"
                    checked={uniformRows}
                    onChange={handleUniformRowsChange}
                    className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="uniformRows" className="text-sm font-semibold text-slate-700 dark:text-slate-300 select-none">Filas uniformes en todos los estantes</label>
                </div>

                {uniformRows && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Filas por estante</label>
                    <input 
                      type="number" 
                      min="1"
                      value={defaultRowsInput}
                      onChange={(e) => handleDefaultRowsChange(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all" 
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">view_column</span>
                Estantes
              </h3>
              <div className="space-y-4">
                {shelves.map((shelf, index) => (
                  <div key={index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex justify-between items-center mb-3">
                      <input 
                        className="font-bold text-slate-900 dark:text-white bg-transparent outline-none border-b border-transparent focus:border-primary px-1 -ml-1 w-full"
                        value={shelf.name}
                        onChange={(e) => handleShelfChange(index, 'name', e.target.value)}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {!uniformRows && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Filas</label>
                          <input 
                            type="number" min="1"
                            value={shelf.rowsInput}
                            onChange={(e) => handleShelfChange(index, 'rows', e.target.value)}
                            className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      )}
                      <div className={uniformRows ? "col-span-2" : ""}>
                        <label className="block text-xs text-slate-500 mb-1">Tipo de estante</label>
                        <select 
                          value={shelf.type}
                          onChange={(e) => handleShelfChange(index, 'type', e.target.value)}
                          className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="single">Simple (Pared)</option>
                          <option value="double">Doble (Centro)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas/Preview */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-b-2xl border-2 border-slate-200 dark:border-slate-800 flex flex-col p-0 min-h-[600px] overflow-hidden shadow-xl mb-6 jagged-edge relative">
            <DraggableContainer className="bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm">
              <LayoutPreview 
                layout={{ shelves, customAreaNames }} 
                onAreaClick={handleAreaClick}
              />
            </DraggableContainer>
          </div>
        </div>

        {/* Custom Modal for Renaming */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 transform transition-all animate-scaleIn">
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Renombrar Área</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Estante: {editingArea?.shelfIdx + 1} · Fila: {editingArea?.rowIdx + 1}</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre de la Ubicación</label>
                    <input 
                      type="text"
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej: A1-Superior"
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 outline-none transition-all font-bold text-slate-900 dark:text-white"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveName}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for New Layout */}
        {isLayoutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 transform transition-all animate-scaleIn">
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nuevo Croquis</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Defina un nombre para el nuevo espacio.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre del Croquis</label>
                    <input 
                      type="text"
                      autoFocus
                      value={newLayoutName}
                      onChange={(e) => setNewLayoutName(e.target.value)}
                      placeholder="Ej: Almacén Principal"
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-primary focus:ring-0 outline-none transition-all font-bold text-slate-900 dark:text-white"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateLayout()}
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <button 
                  onClick={() => setIsLayoutModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateLayout}
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BranchLayoutConfig;
