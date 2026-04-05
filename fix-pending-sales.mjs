import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDzPYYgwvGcYng9ddI4A8nXEpLasoMxXf4",
  authDomain: "inventory-app-jey-123.firebaseapp.com",
  projectId: "inventory-app-jey-123",
  storageBucket: "inventory-app-jey-123.firebasestorage.app",
  messagingSenderId: "225468681713",
  appId: "1:225468681713:web:af0b4bb8c73a3237520850"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPendingSales() {
  try {
    console.log('🔍 Buscando ventas con estado pending_payment...');
    
    const salesRef = collection(db, 'sales');
    const q = query(salesRef, where('status', '==', 'pending_payment'));
    const querySnapshot = await getDocs(q);

    console.log(`✅ Se encontraron ${querySnapshot.size} tickets con estado pending_payment\n`);

    if (querySnapshot.size === 0) {
      console.log('✅ No hay tickets para actualizar.');
      process.exit(0);
    }

    let updatedCount = 0;

    for (const doc of querySnapshot.docs) {
      const saleData = doc.data();
      console.log(`Actualizando Ticket #${saleData.ticketNumber || 'S/N'}...`);
      
      await updateDoc(doc.ref, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: 'Limpieza de registros pendientes'
      });

      updatedCount++;
      console.log(`  ✓ Cambio a estado: cancelled\n`);
    }

    console.log(`\n✅ Actualización completada!`);
    console.log(`📊 Total de tickets actualizados: ${updatedCount}`);
    console.log('🔄 Las notificaciones ahora mostrarán 0 pendientes.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar:', error);
    process.exit(1);
  }
}

fixPendingSales();
