import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import toast from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import {
  buildCategoryHierarchy,
  getProductCategoryPath,
} from "../utils/categories";
import { matchesAnyFuzzy } from "../utils/search";

const Categories = () => {
  const { currentBranch } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryParentId, setEditCategoryParentId] = useState("");
  const [loading, setLoading] = useState(true);

  const categoryHierarchy = useMemo(
    () => buildCategoryHierarchy(categories),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return categoryHierarchy.nodes;

    return categoryHierarchy.nodes.filter((category) =>
      matchesAnyFuzzy(term, [category.name, category.pathLabel]),
    );
  }, [categoryHierarchy, searchTerm]);

  useEffect(() => {
    const q = query(collection(db, "categories"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setCategories(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching categories:", error);
        toast.error("Error cargando categorías.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentBranch) return;

    const productsQuery = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id),
    );

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const counts = {};
      snapshot.forEach((p) => {
        const data = p.data();
        const categoryPath = getProductCategoryPath(data);
        counts[categoryPath] = (counts[categoryPath] || 0) + 1;
      });
      setCategoryCounts(counts);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      const selectedParent =
        categoryHierarchy.byId[newCategoryParentId] || null;

      await addDoc(collection(db, "categories"), {
        name: newCategory.trim(),
        parentId: selectedParent ? selectedParent.id : null,
        createdAt: new Date(),
      });
      setNewCategory("");
      setNewCategoryParentId("");
      toast.success("Categoría creada.");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("No se pudo crear la categoría.");
    }
  };

  const handleRenameCategory = async (category) => {
    setSelectedCategory(category);
    setEditCategoryName(category.name || "");
    setEditCategoryParentId(category.parentId || "");
    setIsEditModalOpen(true);
  };

  const getDescendantIds = (categoryId) => {
    const descendants = new Set();

    const walk = (parentId) => {
      categoryHierarchy.nodes.forEach((node) => {
        if (node.parentId === parentId && !descendants.has(node.id)) {
          descendants.add(node.id);
          walk(node.id);
        }
      });
    };

    walk(categoryId);
    return descendants;
  };

  const handleSaveEditCategory = async (e) => {
    e.preventDefault();

    if (!selectedCategory) return;

    const trimmedName = editCategoryName.trim();
    if (!trimmedName) {
      toast.error("El nombre de categoría es obligatorio.");
      return;
    }

    if (editCategoryParentId === selectedCategory.id) {
      toast.error("Una categoría no puede ser su propio padre.");
      return;
    }

    const descendants = getDescendantIds(selectedCategory.id);
    if (editCategoryParentId && descendants.has(editCategoryParentId)) {
      toast.error("No puedes mover una categoría debajo de su descendiente.");
      return;
    }

    try {
      await updateDoc(doc(db, "categories", selectedCategory.id), {
        name: trimmedName,
        parentId: editCategoryParentId || null,
      });
      toast.success("Categoría actualizada.");
      setIsEditModalOpen(false);
      setSelectedCategory(null);
      setEditCategoryName("");
      setEditCategoryParentId("");
    } catch (error) {
      console.error("Error renaming category:", error);
      toast.error("No se pudo renombrar categoría.");
    }
  };

  const handleDeleteCategory = async (category) => {
    const hasChildren = categoryHierarchy.nodes.some(
      (node) => node.parentId === category.id,
    );

    if (hasChildren) {
      toast.error("No puedes eliminar una categoría que tiene subcategorías.");
      return;
    }

    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!selectedCategory) return;

    try {
      await deleteDoc(doc(db, "categories", selectedCategory.id));
      toast.success("Categoría eliminada.");
      setIsDeleteModalOpen(false);
      setSelectedCategory(null);
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("No se pudo eliminar categoría.");
    }
  };

  const getAccumulatedCount = (categoryNode) => {
    const prefix = `${categoryNode.pathLabel} /`;
    return Object.entries(categoryCounts).reduce((acc, [path, count]) => {
      if (path === categoryNode.pathLabel || path.startsWith(prefix)) {
        return acc + Number(count || 0);
      }
      return acc;
    }, 0);
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6">
          <div className="max-w-screen-xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                  Gestión de Categorías
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                  Administra categorías y subcategorías con estructura
                  jerárquica
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddCategory}
              className="grid grid-cols-1 lg:grid-cols-[1fr_320px_auto] gap-3"
            >
              <div>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nueva categoría o subcategoría"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                />
              </div>
              <div>
                <select
                  value={newCategoryParentId}
                  onChange={(e) => setNewCategoryParentId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                >
                  <option value="">Sin padre (categoría principal)</option>
                  {categoryHierarchy.nodes.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.pathLabel}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Agregar
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o ruta (ej: pisos / vinílicos)"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                Total categorías: {categoryHierarchy.nodes.length}
              </div>
              <div className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                Mostrando: {filteredCategories.length}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-screen-xl mx-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                  progress_activity
                </span>
              </div>
            ) : categoryHierarchy.nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm p-10 text-center">
                <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-6 rounded-full text-slate-300">
                  label_off
                </span>
                <p className="font-bold text-lg text-slate-700 dark:text-slate-300">
                  No hay categorías
                </p>
                <p className="text-sm mt-1">
                  Agregue una nueva categoría para comenzar
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Nombre
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Tipo
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Artículos
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Padre
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Creado
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCategories.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-8 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                          >
                            No se encontraron categorías con ese criterio.
                          </td>
                        </tr>
                      ) : (
                        filteredCategories.map((category) => (
                          <tr
                            key={category.id}
                            className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-8 py-6">
                              <p
                                className="font-black text-slate-900 dark:text-white tracking-tight"
                                style={{
                                  paddingLeft: `${category.level * 16}px`,
                                }}
                              >
                                {category.level > 0 ? "↳ " : ""}
                                {category.name}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                                {category.pathLabel}
                              </p>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                                {category.parentId
                                  ? "Subcategoría"
                                  : "Categoría"}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold">
                                {getAccumulatedCount(category)}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
                                {category.parentId
                                  ? categoryHierarchy.byId[category.parentId]
                                      ?.name || "N/A"
                                  : "-"}
                              </p>
                            </td>
                            <td className="px-8 py-6 whitespace-nowrap">
                              <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">
                                {category.createdAt
                                  ?.toDate?.()
                                  ?.toLocaleDateString?.() || "N/A"}
                              </p>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleRenameCategory(category)}
                                  className="size-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 transition-all"
                                  title="Editar"
                                >
                                  <span className="material-symbols-outlined">
                                    edit
                                  </span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(category)}
                                  className="size-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                  title="Eliminar"
                                >
                                  <span className="material-symbols-outlined">
                                    delete
                                  </span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditModalOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsEditModalOpen(false);
              setSelectedCategory(null);
            }}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md animate-scaleUp overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Editar Categoría
              </h3>
            </div>
            <form onSubmit={handleSaveEditCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  Nombre
                </label>
                <input
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-primary"
                  placeholder="Nombre de categoría"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  Categoría padre
                </label>
                <select
                  value={editCategoryParentId}
                  onChange={(e) => setEditCategoryParentId(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-primary"
                >
                  <option value="">Sin padre (categoría principal)</option>
                  {categoryHierarchy.nodes
                    .filter((cat) => cat.id !== selectedCategory.id)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.pathLabel}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedCategory(null);
                  }}
                  className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 font-black bg-primary text-white rounded-xl shadow-lg shadow-primary/20 transition-all"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setSelectedCategory(null);
            }}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md animate-scaleUp overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Confirmar eliminación
              </h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Se eliminará la categoría{" "}
                <strong>{selectedCategory.name}</strong>. Esta acción no se
                puede deshacer.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedCategory(null);
                  }}
                  className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCategory}
                  className="flex-1 py-3 font-black bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Categories;
