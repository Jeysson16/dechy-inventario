/**
 * SCRIPT PARA LIMPIAR TICKETS PENDIENTES
 * Copia este código en la CONSOLA DEL NAVEGADOR (F12 > Console)
 * mientras estés loggeado en la aplicación
 */

import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './src/config/firebase.js';

window.cleanPendingSales = async function() {
  console.log('🔍 Iniciando limpieza de tickets pending_payment...');
  
  try {
    const salesRef = collection(db, 'sales');
    const q = query(salesRef, where('status', '==', 'pending_payment'));
    const querySnapshot = await getDocs(q);

    console.log(`✅ Se encontraron ${querySnapshot.size} tickets\n`);

    if (querySnapshot.size === 0) {
      console.log('✅ No hay tickets pendientes para limpiar.');
      return;
    }

    let updatedCount = 0;

    for (const doc of querySnapshot.docs) {
      const saleData = doc.data();
      console.log(`🔄 Actualizando Ticket #${saleData.ticketNumber || 'S/N'}...`);
      
      await updateDoc(doc.ref, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'Limpieza automática de registros pendientes'
      });

      updatedCount++;
      console.log(`  ✓ Cambio a estado: cancelled\n`);
    }

    console.log(`\n✅ ACTUALIZACIÓN COMPLETADA!`);
    console.log(`📊 Total actualizados: ${updatedCount}`);
    console.log('🔄 Recarga la página para ver los cambios.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

console.log('✅ Función disponible: cleanPendingSales()');
console.log('Usa: await cleanPendingSales()');
