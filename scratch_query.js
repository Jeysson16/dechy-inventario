import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAatVXzAYES-bKrWQDGcZqoYL_MnYy2quk",
  authDomain: "dechy-inventario.firebaseapp.com",
  projectId: "dechy-inventario",
  storageBucket: "dechy-inventario.firebasestorage.app",
  messagingSenderId: "314212389763",
  appId: "1:314212389763:web:31b95d4a925724646d5cb6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSales() {
  console.log("Checking sales in Firestore...");
  try {
    const querySnapshot = await getDocs(collection(db, 'sales'));
    console.log(`Found ${querySnapshot.size} total sales.`);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Sale ID: ${doc.id}`);
      console.log(`  Ticket: ${data.ticketNumber}`);
      console.log(`  BranchId: ${data.branchId}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Date: ${data.date ? data.date.toDate().toISOString() : 'N/A'}`);
      console.log(`  Total: ${data.totalValue}`);
    });
  } catch (error) {
    console.error("Error querying sales:", error);
  }
}

checkSales();
