import { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, messaging, requestNotificationPermission, setupMessageListener } from '../config/firebase';
import { toast } from 'react-hot-toast';

export const useNotifications = (userId) => {
  const [notifications, setNotifications] = useState([]);
  const [fcmToken, setFcmToken] = useState(null);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.8;
      audio.play().catch((error) => {
        console.error('Error playing notification sound:', error);
      });
    } catch (error) {
      console.error('Error creating audio object:', error);
    }
  };

  // Initialize notifications permission and token
  useEffect(() => {
    const initializeNotifications = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('Service Worker registered:', registration);

          const token = await requestNotificationPermission();
          if (token) {
            setFcmToken(token);
            // Store token in user's document for server-side sending
            await addDoc(collection(db, 'notificationTokens'), {
              userId,
              token,
              createdAt: new Date(),
              active: true
            });
          }
        } catch (error) {
          console.error('Error initializing notifications:', error);
        }
      }
    };

    if (userId) {
      initializeNotifications();
    }
  }, [userId]);

  // Listen for incoming messages when app is in foreground
  useEffect(() => {
    if (messaging && userId) {
      const unsubscribe = setupMessageListener((payload) => {
        console.log('Message received in foreground:', payload);

        // Show toast notification
        toast.success(payload.notification?.title || 'Nueva notificación', {
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

        setNotifications(prev => [newNotification, ...prev]);
      });

      return unsubscribe;
    }
  }, [userId]);

  // Listen for notifications from Firestore (for background messages and cross-device)
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().createdAt?.toDate() || new Date(),
      }));

      setNotifications(newNotifications);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId) => {
    try {
      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );

      // Update in Firestore if it's a stored notification
      if (typeof notificationId === 'string' && notificationId.length > 10) {
        await addDoc(collection(db, 'notificationReads'), {
          notificationId,
          userId,
          readAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const sendNotificationToAll = async (title, body, data = {}) => {
    try {
      // Get all active FCM tokens
      const tokensSnapshot = await getDocs(
        query(collection(db, 'notificationTokens'), where('active', '==', true))
      );

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

      if (tokens.length === 0) {
        console.log('No active FCM tokens found');
        return;
      }

      // Store notification in Firestore for persistence
      await addDoc(collection(db, 'notifications'), {
        title,
        body,
        data,
        createdAt: new Date(),
        targetUserId: null, // null means broadcast to all
        readBy: [],
      });

      // For client-side sending, we'd need to use Firebase Cloud Functions
      // For now, we'll rely on the stored notification being picked up by listeners
      console.log('Notification stored and will be sent to', tokens.length, 'devices');

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  return {
    notifications,
    fcmToken,
    markAsRead,
    sendNotificationToAll,
  };
};