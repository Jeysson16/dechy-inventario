import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAatVXzAYES-bKrWQDGcZqoYL_MnYy2quk",
  authDomain: "dechy-inventario.firebaseapp.com",
  projectId: "dechy-inventario",
  storageBucket: "dechy-inventario.firebasestorage.app",
  messagingSenderId: "314212389763",
  appId: "1:314212389763:web:31b95d4a925724646d5cb6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
