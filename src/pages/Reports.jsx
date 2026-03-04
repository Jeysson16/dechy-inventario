import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const { currentBranch } = useAuth();
  const [loading, setLoading] = useState(false);

  const downloadCSV = (csvData, filename) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const escapeCSV = (field) => {
    if (field === undefined || field === null) return '""';
    const stringField = String(field);
    return `"${stringField.replace(/"/g, '""')}"`;
  };

  const exportCurrentInventory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "products"), where("branchId", "==", currentBranch.id));
      const querySnapshot = await getDocs(q);
      
      let csv = "ID,Nombre,SKU,Categoría,Dimensiones,Stock,Precio U.,Valor Total,Estado\n";
      
      querySnapshot.forEach((doc) => {
        const p = doc.data();
        const value = (Number(p.stock) || 0) * (Number(p.price) || 0);
        csv += `${escapeCSV(doc.id)},${escapeCSV(p.name)},${escapeCSV(p.sku)},${escapeCSV(p.category)},${escapeCSV(p.dimensions)},${escapeCSV(p.stock)},${escapeCSV(p.price)},${escapeCSV(value)},${escapeCSV(p.status)}\n`;
      });

      downloadCSV(csv, `inventario_sucursal_${currentBranch.name.replace(/\\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) {
      console.error("Error al exportar:", e);
      alert("Hubo un error al exportar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  const exportLowStock = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "products"), where("branchId", "==", currentBranch.id));
      const querySnapshot = await getDocs(q);
      
      let csv = "Nombre,SKU,Stock Actual,Estado\n";
      
      querySnapshot.forEach((doc) => {
        const p = doc.data();
        const stock = Number(p.stock) || 0;
        if (stock <= 10) {
          csv += `${escapeCSV(p.name)},${escapeCSV(p.sku)},${escapeCSV(stock)},${escapeCSV(p.status)}\n`;
        }
      });

      downloadCSV(csv, `alertas_stock_${currentBranch.name.replace(/\\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) {
      console.error("Error al exportar:", e);
      alert("Hubo un error al exportar alertas de stock.");
    } finally {
      setLoading(false);
    }
  };

  const exportGlobalBranches = async () => {
     setLoading(true);
    try {
      const [branchesSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "products"))
      ]);
      const branchesData = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let csv = "Sucursal,Ubicación,Total Productos,Unidades Totales,Valor Estimado (S/.)\n";

      branchesData.forEach(branch => {
        const branchProducts = productsData.filter(p => p.branchId === branch.id);
        let totalStock = 0;
        let totalValue = 0;
        branchProducts.forEach(p => {
          const stock = Number(p.stock) || 0;
          const price = Number(p.price) || 0;
          totalStock += stock;
          totalValue += stock * price;
        });

        csv += `${escapeCSV(branch.name)},${escapeCSV(branch.location)},${escapeCSV(branchProducts.length)},${escapeCSV(totalStock)},${escapeCSV(totalValue)}\n`;
      });

      downloadCSV(csv, `rendimiento_global_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e) {
      console.error("Error al exportar:", e);
      alert("Hubo un error al exportar el reporte global.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col flex-1 px-4 md:px-6 lg:px-40 py-8 animate-fadeIn">
        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-3xl">insert_chart</span>
          <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">Reportes y Exportación</h2>
        </div>

        <p className="text-slate-500 mb-6">Genera y descarga informes en formato CSV para análisis detallado en herramientas como Excel o Google Sheets.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card: Inventario Actual */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Inventario Actual</h3>
              <p className="text-sm text-slate-500">Listado completo de productos, categorías, stock y valores para la sucursal activa ({currentBranch?.name}).</p>
            </div>
             <button 
                onClick={exportCurrentInventory}
                disabled={loading}
                className="mt-auto w-full bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">download</span> Descargar CSV
              </button>
          </div>

          {/* Card: Alertas Stock Bajo */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-amber-500/50 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Alertas Stock Bajo</h3>
              <p className="text-sm text-slate-500">Filtra rápidamente los productos que requieren reabastecimiento (stock &lt;= 10 unidades).</p>
            </div>
             <button 
                onClick={exportLowStock}
                disabled={loading}
                className="mt-auto w-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">file_download</span> Descargar CSV
              </button>
          </div>

          {/* Card: Rendimiento Global */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-start gap-4 hover:border-emerald-500/50 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <span className="material-symbols-outlined text-2xl">store</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Rendimiento Consolidado</h3>
              <p className="text-sm text-slate-500">Resumen general de artículos y valor estimado acumulado a través de todas las sucursales de la compañía.</p>
            </div>
             <button 
                onClick={exportGlobalBranches}
                disabled={loading}
                className="mt-auto w-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span> Generar Excel (CSV)
              </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
