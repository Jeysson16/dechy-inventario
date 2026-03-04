import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDzPYYgwvGcYng9ddI4A8nXEpLasoMxXf4",
  authDomain: "inventory-app-jey-123.firebaseapp.com",
  projectId: "inventory-app-jey-123",
  storageBucket: "inventory-app-jey-123.firebasestorage.app",
  messagingSenderId: "225468681713",
  appId: "1:225468681713:web:af0b4bb8c73a3237520850"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Auth and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);
