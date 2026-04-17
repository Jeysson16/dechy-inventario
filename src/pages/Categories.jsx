import { useEffect, useState } from "react";
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

const Categories = () => {
  const { currentBranch } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);

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
        const categoryName = data.category?.trim() || "Sin categoría";
        counts[categoryName] = (counts[categoryName] || 0) + 1;
      });
      setCategoryCounts(counts);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      await addDoc(collection(db, "categories"), {
        name: newCategory.trim(),
        createdAt: new Date(),
      });
      setNewCategory("");
      toast.success("Categoría creada.");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("No se pudo crear la categoría.");
    }
  };

  const handleRenameCategory = async (category) => {
    const name = window.prompt("Nuevo nombre de categoría", category.name);
    if (!name || !name.trim() || name.trim() === category.name) return;

    try {
      await updateDoc(doc(db, "categories", category.id), {
        name: name.trim(),
      });
      toast.success("Categoría actualizada.");
    } catch (error) {
      console.error("Error renaming category:", error);
      toast.error("No se pudo renombrar categoría.");
    }
  };

  const handleDeleteCategory = async (category) => {
    const confirm = window.confirm(`¿Eliminar categoría "${category.name}"?`);
    if (!confirm) return;

    try {
      await deleteDoc(doc(db, "categories", category.id));
      toast.success("Categoría eliminada.");
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("No se pudo eliminar categoría.");
    }
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
                  Administración de categorías del inventario
                </p>
              </div>
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-3">
              <div className="flex-1 max-w-md">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nueva categoría"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Agregar
              </button>
            </form>
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
            ) : categories.length === 0 ? (
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
                          Artículos
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
                      {categories.map((category) => (
                        <tr
                          key={category.id}
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-8 py-6">
                            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                              {category.name}
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold">
                              {categoryCounts[category.name] || 0}
                            </span>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Categories;
