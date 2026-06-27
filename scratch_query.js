import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
