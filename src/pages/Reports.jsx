import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const { currentBranch } = useAuth();
  const [loading, setLoading] = useState(false);

  const generateExcel = async (dataRows, colHeaders, filename, isLowStockReport = false) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Reporte DECHY');

      // Style Header
      sheet.columns = colHeaders;
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7553E1' } // primary color
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data
      dataRows.forEach((row) => {
        const addedRow = sheet.addRow(row);
        
        // Highlight low stock if applicable
        if (isLowStockReport || (row.stock !== undefined && row.stock <= 10)) {
           addedRow.fill = {
             type: 'pattern',
             pattern: 'solid',
             fgColor: { argb: 'FFFFE4E6' } // rose-100
           };
           addedRow.font = { color: { argb: 'FFE11D48' } }; // rose-600
        }
      });

      // Format currency columns
      sheet.columns.forEach(column => {
        if (column.key && (column.key.toLowerCase().includes('price') || column.key.toLowerCase().includes('value'))) {
           column.numFmt = '"S/"#,##0.00';
           column.alignment = { horizontal: 'right' };
        }
      });

      // Write and save
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${filename}.xlsx`);
    } catch (error) {
       console.error("Error generating excel:", error);
       throw error;
    }
  };

  const exportCurrentInventory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "products"), where("branchId", "==", currentBranch.id));
      const querySnapshot = await getDocs(q);
      
      const rows = [];
      querySnapshot.forEach((doc) => {
        const p = doc.data();
        const value = (Number(p.stock) || 0) * (Number(p.unitPrice) || Number(p.price) || 0);
        rows.push({
           id: doc.id,
           name: p.name,
           sku: p.sku || '',
           category: p.category || '',
           dimensions: p.dimensions || '',
           stock: Number(p.stock) || 0,
           unitsPerBox: Number(p.unitsPerBox) || 0,
           unitPrice: Number(p.unitPrice || p.price) || 0,
           boxPrice: Number(p.boxPrice) || 0,
           totalValue: value,
           status: p.status || ''
        });
      });

      const cols = [
        { header: 'ID', key: 'id', width: 25 },
        { header: 'Nombre', key: 'name', width: 40 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Categoría', key: 'category', width: 20 },
        { header: 'Dimensiones', key: 'dimensions', width: 20 },
        { header: 'Stock', key: 'stock', width: 10 },
        { header: 'Uds Caja', key: 'unitsPerBox', width: 10 },
        { header: 'Precio U.', key: 'unitPrice', width: 15 },
        { header: 'Precio Caja', key: 'boxPrice', width: 15 },
        { header: 'Valor Total', key: 'totalValue', width: 15 },
        { header: 'Estado', key: 'status', width: 15 },
      ];

      await generateExcel(rows, cols, `inventario_${currentBranch.name.replace(/\\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`);
      toast.success("Inventario exportado a Excel.");
    } catch (e) {
      console.error("Error al exportar:", e);
      toast.error("Hubo un error al exportar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  const exportLowStock = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "products"), where("branchId", "==", currentBranch.id));
      const querySnapshot = await getDocs(q);
      
      const rows = [];
      querySnapshot.forEach((doc) => {
        const p = doc.data();
        const stock = Number(p.stock) || 0;
        if (stock <= 10) {
          rows.push({
            name: p.name,
            sku: p.sku || '',
            stock: stock,
            status: p.status || ''
          });
        }
      });

      const cols = [
        { header: 'Nombre', key: 'name', width: 40 },
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Stock Actual', key: 'stock', width: 15 },
        { header: 'Estado', key: 'status', width: 20 },
      ];

      await generateExcel(rows, cols, `alertas_stock_${currentBranch.name.replace(/\\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`, true);
      toast.success("Alertas exportadas a Excel.");
    } catch (e) {
      console.error("Error al exportar:", e);
      toast.error("Hubo un error al exportar alertas de stock.");
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

      const rows = [];
      branchesData.forEach(branch => {
        const branchProducts = productsData.filter(p => p.branchId === branch.id);
        let totalStock = 0;
        let totalValue = 0;
        branchProducts.forEach(p => {
          const stock = Number(p.stock) || 0;
          const price = Number(p.unitPrice || p.price) || 0;
          totalStock += stock;
          totalValue += stock * price;
        });

        rows.push({
           name: branch.name,
           location: branch.location || '',
           totalProducts: branchProducts.length,
           totalStock: totalStock,
           totalValue: totalValue
        });
      });

      const cols = [
        { header: 'Sucursal', key: 'name', width: 30 },
        { header: 'Ubicación', key: 'location', width: 30 },
        { header: 'Total Productos', key: 'totalProducts', width: 20 },
        { header: 'Unidades Totales', key: 'totalStock', width: 20 },
        { header: 'Valor Estimado', key: 'totalValue', width: 20 },
      ];

      await generateExcel(rows, cols, `rendimiento_global_${new Date().toISOString().split('T')[0]}`);
      toast.success("Reporte global exportado.");
    } catch (e) {
      console.error("Error al exportar:", e);
      toast.error("Hubo un error al exportar el reporte global.");
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
                <span className="material-symbols-outlined text-sm">download</span> Descargar Excel
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
                <span className="material-symbols-outlined text-sm">file_download</span> Descargar Excel
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
                <span className="material-symbols-outlined text-sm">receipt_long</span> Generar Excel
              </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
};

export default Reports;
