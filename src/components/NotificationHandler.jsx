import { useEffect } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "../context/AuthContext";

const NotificationHandler = () => {
  const { currentUser } = useAuth();

  // Only initialize notifications if we have a user and notifications are supported
  const shouldUseNotifications =
    currentUser?.uid &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  const { notifications } = useNotifications(
    shouldUseNotifications ? currentUser.uid : null,
  );

  useEffect(() => {
    // Only set up service worker listener if notifications are supported
    if (!shouldUseNotifications) return;

    // Listen for service worker messages (for background notification clicks)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "PLAY_NOTIFICATION_SOUND") {
          // Play sound when notification is clicked from background
          try {
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.8;
            audio.play().catch((error) => {
              console.error("Error playing notification sound:", error);
            });
          } catch (error) {
            console.error("Error creating audio object:", error);
          }
        }
      });
    }
  }, [shouldUseNotifications]);

  // Handle unread notifications
  useEffect(() => {
    const unreadNotifications = notifications.filter((n) => !n.read);

    if (unreadNotifications.length > 0) {
      // You could show a notification badge or play sound for unread notifications
      // For now, we'll just log them
      console.log("Unread notifications:", unreadNotifications);
    }
  }, [notifications]);

  return null; // This component doesn't render anything
};

export default NotificationHandler;
