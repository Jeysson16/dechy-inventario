import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const productCatalogFirebaseConfig = {
  apiKey: import.meta.env.VITE_CATALOG_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_CATALOG_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_CATALOG_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_CATALOG_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_CATALOG_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_CATALOG_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const productCatalogApp =
  getApps().find((item) => item.name === "productCatalog") ||
  initializeApp(productCatalogFirebaseConfig, "productCatalog");

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const productCatalogDb = getFirestore(productCatalogApp);

// Initialize Firebase Auth and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
export const messaging = getMessaging(app);

// Request permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return null;
    }

    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) {
      console.log("This browser does not support service workers");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Check if messaging is available
      if (!messaging) {
        console.log("Firebase messaging is not available");
        return null;
      }

      // For now, skip FCM token if VAPID key is not configured
      const vapidKey = "YOUR_VAPID_KEY_HERE";
      if (vapidKey === "YOUR_VAPID_KEY_HERE") {
        console.log("VAPID key not configured, using local notifications only");
        return "local-only"; // Return a placeholder token for local notifications
      }

      const token = await getToken(messaging, {
        vapidKey: vapidKey,
      });
      return token;
    }
  } catch (error) {
    console.error("Error getting notification permission:", error);
  }
  return null;
};

// Handle incoming messages when app is in foreground
export const setupMessageListener = (callback) => {
  if (messaging) {
    const unsubscribe = onMessage(messaging, (payload) => {
      callback(payload);
    });
    return unsubscribe;
  }
  return () => {};
};
