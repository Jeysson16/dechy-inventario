// Firebase Messaging Service Worker
importScripts(
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js",
);

const firebaseConfig = {
  apiKey: "AIzaSyDzPYYgwvGcYng9ddI4A8nXEpLasoMxXf4",
  authDomain: "inventory-app-jey-123.firebaseapp.com",
  projectId: "inventory-app-jey-123",
  storageBucket: "inventory-app-jey-123.firebasestorage.app",
  messagingSenderId: "225468681713",
  appId: "1:225468681713:web:af0b4bb8c73a3237520850",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("Received background message:", payload);

  const notificationTitle = payload.notification?.title || "Nueva notificación";
  const notificationOptions = {
    body: payload.notification?.body,
    icon: "/icon-192x192.png", // Add this icon to your public folder
    badge: "/icon-192x192.png",
    tag: "notification-tag", // Prevents duplicate notifications
    requireInteraction: true,
    silent: false,
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);

  // Play sound (background messages can't play audio directly)
  // The audio will be played when the notification is clicked and app opens
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received.");

  event.notification.close();

  // Play sound when notification is clicked
  try {
    // This won't work in service worker, but we can send a message to the main thread
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "PLAY_NOTIFICATION_SOUND",
          data: event.notification.data,
        });
      });
    });
  } catch (error) {
    console.error("Error playing sound on notification click:", error);
  }

  // Focus on the app window or open a new one
  event.waitUntil(
    clients.matchAll().then((clientList) => {
      const url = "/"; // Or specific URL like '/ventas'

      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
