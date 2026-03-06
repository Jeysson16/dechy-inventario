import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';

const BranchLayoutConfig = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState(null);
  
  // Grid config state
  const [numShelves, setNumShelves] = useState(3);
  const [numShelvesInput, setNumShelvesInput] = useState('3');
  const [uniformRows, setUniformRows] = useState(true);
  const [defaultRows, setDefaultRows] = useState(4);
  const [defaultRowsInput, setDefaultRowsInput] = useState('4');
  const [shelves, setShelves] = useState([]);
  const [customAreaNames, setCustomAreaNames] = useState({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const branchDoc = await getDoc(doc(db, "branches", id));
        if (branchDoc.exists()) {
          const data = branchDoc.data();
          setBranch({ id: branchDoc.id, ...data });
          
          if (data.layout) {
            const loadedShelves = (data.layout.shelves || []).map(s => ({
              ...s,
              rowsInput: String(s.rows || 4)
            }));
            setShelves(loadedShelves);
            setCustomAreaNames(data.layout.customAreaNames || {});
          } else {
            // Initialize default shelves
            const initialShelves = Array.from({ length: 3 }, (_, i) => ({
              id: `shelf-${i + 1}`,
              name: `Estante ${i + 1}`,
              rows: 4,
              rowsInput: '4',
              type: i === 0 || i === 2 ? 'single' : 'double', // first and last single, middle double
            }));
            setShelves(initialShelves);
          }
        } else {
          toast.error('Sucursal no encontrada');
          navigate('/sucursales');
        }
      } catch (error) {
        console.error("Error fetching branch:", error);
        toast.error('Error al cargar la sucursal');
      } finally {
        setLoading(false);
      }
    };
    fetchBranch();
  }, [id, navigate]);

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
      await updateDoc(doc(db, "branches", id), {
        layout: {
          numShelves,
          uniformRows,
          defaultRows,
          shelves,
          customAreaNames
        }
      });
      toast.success('Croquis guardado correctamente');
      navigate('/sucursales');
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error('Error al guardar el croquis');
    }
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
            <p className="text-slate-500 dark:text-slate-400 mt-1">Sucursal: {branch?.name}</p>
          </div>
          <div className="ml-auto flex gap-3">
             <button onClick={handleSave} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
              <span className="material-symbols-outlined text-sm">save</span>
              <span>Guardar Layout</span>
            </button>
          </div>
        </div>

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
      </div>
    </AppLayout>
  );
};

export default BranchLayoutConfig;
