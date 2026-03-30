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
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
        Categorías
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
        Gestión de categorías del inventario (CRUD).
      </p>

      <section className="mt-6 mb-8 w-full max-w-lg">
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Nueva categoría"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 font-bold text-white hover:bg-primary-dark transition"
          >
            Agregar
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Artículos</th>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan="3"
                  className="px-4 py-5 text-center text-slate-500"
                >
                  Cargando categorías...
                </td>
              </tr>
            )}
            {!loading && categories.length === 0 && (
              <tr>
                <td
                  colSpan="3"
                  className="px-4 py-5 text-center text-slate-500"
                >
                  No hay categorías.
                </td>
              </tr>
            )}
            {categories.map((cat) => (
              <tr
                key={cat.id}
                className="border-t border-slate-100 odd:bg-white even:bg-slate-50 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-850"
              >
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                  {cat.name}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-semibold">
                  {categoryCounts[cat.name] || 0}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {cat.createdAt?.toDate
                    ? cat.createdAt.toDate().toLocaleString("es-ES")
                    : ""}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => handleRenameCategory(cat)}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="rounded-lg bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Categories;
