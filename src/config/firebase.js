import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, onMessage } from 'firebase/messaging';

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

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = getMessaging(app);

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY_HERE' // Replace with your actual VAPID key
      });
      return token;
    } else {
      console.log('Notification permission denied');
      return 'local-only';
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'local-only';
  }
};

// Setup message listener for foreground messages
export const setupMessageListener = (callback) => {
  if (!messaging) return () => {};
  
  const unsubscribe = onMessage(messaging, (payload) => {
    callback(payload);
  });
  
  return unsubscribe;
};
