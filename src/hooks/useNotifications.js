import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  db,
  messaging,
  requestNotificationPermission,
  setupMessageListener,
} from "../config/firebase";
import { toast } from "react-hot-toast";

export const useNotifications = (userId) => {
  const [notifications, setNotifications] = useState([]);
  const [fcmToken, setFcmToken] = useState(null);

  const playNotificationSound = () => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.8;
      audio.play().catch((error) => {
        console.error("Error playing notification sound:", error);
      });
    } catch (error) {
      console.error("Error creating audio object:", error);
    }
  };

  // Initialize notifications permission and token
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!userId) return;

      // Check if notifications are supported
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        console.log("Notifications not supported in this browser");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
        );
        console.log("Service Worker registered:", registration);

        const token = await requestNotificationPermission();
        if (token) {
          setFcmToken(token);
          // Only store token in Firestore if it's a real FCM token
          if (token !== "local-only") {
            try {
              await addDoc(collection(db, "notificationTokens"), {
                userId,
                token,
                createdAt: new Date(),
                active: true,
              });
            } catch (err) {
              console.error("Error storing notification token:", err);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing notifications:", error);
        // Don't fail the app if notifications don't work
      }
    };

    initializeNotifications();
  }, [userId]);

  // Listen for incoming messages when app is in foreground
  useEffect(() => {
    if (messaging && userId) {
      try {
        const unsubscribe = setupMessageListener((payload) => {
          console.log("Message received in foreground:", payload);

          // Show toast notification
          toast.success(payload.notification?.title || "Nueva notificación", {
            description: payload.notification?.body,
            duration: 5000,
          });

          // Play sound
          playNotificationSound();

          // Add to local notifications list
          const newNotification = {
            id: Date.now(),
            title: payload.notification?.title,
            body: payload.notification?.body,
            timestamp: new Date(),
            read: false,
          };

          setNotifications((prev) => [newNotification, ...prev]);
        });

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up message listener:", error);
        return () => {};
      }
    }
  }, [userId]);

  // Listen for notifications from Firestore (simplified query without complex filters)
  useEffect(() => {
    if (!userId) return;

    try {
      // Simplified query: just get recent notifications ordered by createdAt
      const q = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc"),
        limit(50),
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const newNotifications = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().createdAt?.toDate() || new Date(),
          }));

          setNotifications(newNotifications);
        },
        (error) => {
          console.error("Error listening for notifications:", error);
          // If index is missing, just log it - don't break the app
          if (error.code === "failed-precondition") {
            console.log(
              "Firestore index not yet created. Notifications will still work locally and via FCM.",
            );
          }
        },
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up notification listener:", error);
      return () => {};
    }
  }, [userId]);

  const markAsRead = async (notificationId) => {
    try {
      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif,
        ),
      );

      // Update in Firestore if it's a stored notification
      if (typeof notificationId === "string" && notificationId.length > 10) {
        try {
          await addDoc(collection(db, "notificationReads"), {
            notificationId,
            userId,
            readAt: new Date(),
          });
        } catch (err) {
          console.error("Error marking notification as read:", err);
        }
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const sendNotificationToAll = async (title, body, data = {}) => {
    try {
      // Store notification in Firestore for persistence and cross-device sync
      await addDoc(collection(db, "notifications"), {
        title,
        body,
        data,
        createdAt: new Date(),
        targetUserId: null, // null means broadcast to all
        readBy: [],
      });

      // For now, we rely on Firestore listeners for cross-device notifications
      // When FCM is properly configured, we can add server-side sending
      console.log("Notification stored and will be synced to all devices");
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  return {
    notifications,
    fcmToken,
    markAsRead,
    sendNotificationToAll,
  };
};
