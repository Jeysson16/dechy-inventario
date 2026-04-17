import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { db } from "../config/firebase";

const AUDIO_DEDUP_KEY = "sales-notification:last-play";
const AUDIO_DEDUP_WINDOW_MS = 1500;

let notificationAudio = null;
let audioUnlocked = false;
let bootstrapBound = false;

const getSafeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const canPlayAudioInThisTab = () => {
  if (typeof window === "undefined") return false;

  const storage = getSafeStorage();
  const now = Date.now();

  if (!storage) return true;

  const lastPlay = Number(storage.getItem(AUDIO_DEDUP_KEY) || 0);
  if (now - lastPlay < AUDIO_DEDUP_WINDOW_MS) {
    return false;
  }

  storage.setItem(AUDIO_DEDUP_KEY, String(now));
  return true;
};

const getNotificationAudio = () => {
  if (typeof window === "undefined") return null;

  if (!notificationAudio) {
    notificationAudio = new Audio("/notification.mp3");
    notificationAudio.preload = "auto";
    notificationAudio.volume = 0.8;
    try {
      notificationAudio.load();
    } catch {
      // Silencioso: algunos navegadores pueden restringir load.
    }
  }

  return notificationAudio;
};

const unlockNotificationAudio = async () => {
  const audio = getNotificationAudio();
  if (!audio || audioUnlocked) return audioUnlocked;

  try {
    audio.muted = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audioUnlocked = true;
    return true;
  } catch {
    audio.muted = false;
    return false;
  }
};

const bootstrapNotificationCapabilities = () => {
  if (typeof window === "undefined" || bootstrapBound) return () => {};

  const bootstrap = async () => {
    await requestNotificationPermission();
    await unlockNotificationAudio();

    window.removeEventListener("pointerdown", bootstrap);
    window.removeEventListener("keydown", bootstrap);
    window.removeEventListener("touchstart", bootstrap);
    bootstrapBound = false;
  };

  bootstrapBound = true;
  window.addEventListener("pointerdown", bootstrap, { passive: true });
  window.addEventListener("keydown", bootstrap);
  window.addEventListener("touchstart", bootstrap, { passive: true });

  return () => {
    window.removeEventListener("pointerdown", bootstrap);
    window.removeEventListener("keydown", bootstrap);
    window.removeEventListener("touchstart", bootstrap);
    bootstrapBound = false;
  };
};

export const playNotificationSound = async () => {
  if (typeof window === "undefined" || !canPlayAudioInThisTab()) return false;

  try {
    const audio = getNotificationAudio();
    if (!audio) return false;

    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    // Ignora bloqueos de autoplay para no romper la UX.
    return false;
  }
};

export const requestNotificationPermission = async () => {
  if (typeof Notification === "undefined") return "unsupported";

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
};

export const showBrowserNotification = async (title, body) => {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return false;

  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          tag: "sales-realtime-notification",
          renotify: true,
        });
        return true;
      }
    }

    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
};

export const notifySaleEvent = async ({ title, message, showToast = true }) => {
  await Promise.allSettled([
    showBrowserNotification(title, message),
    playNotificationSound(),
  ]);

  if (showToast) {
    toast.success(message);
  }
};

export const useRealtimeSalesNotifications = ({
  branchId,
  enabled = true,
  buildMessage,
  shouldNotify,
  onSaleDetected,
}) => {
  const initialLoadRef = useRef(true);
  const seenSaleIdsRef = useRef(new Set());
  const buildMessageRef = useRef(buildMessage);
  const shouldNotifyRef = useRef(shouldNotify);
  const onSaleDetectedRef = useRef(onSaleDetected);

  useEffect(() => {
    buildMessageRef.current = buildMessage;
    shouldNotifyRef.current = shouldNotify;
    onSaleDetectedRef.current = onSaleDetected;
  }, [buildMessage, shouldNotify, onSaleDetected]);

  useEffect(() => {
    const cleanup = bootstrapNotificationCapabilities();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!enabled || !branchId) return;

    initialLoadRef.current = true;
    seenSaleIdsRef.current.clear();

    const salesQuery = query(
      collection(db, "sales"),
      where("branchId", "==", branchId),
    );

    const unsubscribe = onSnapshot(
      salesQuery,
      async (snapshot) => {
        if (initialLoadRef.current) {
          snapshot.forEach((docSnap) => {
            seenSaleIdsRef.current.add(docSnap.id);
          });
          initialLoadRef.current = false;
          return;
        }

        const addedChanges = snapshot
          .docChanges()
          .filter((change) => change.type === "added");

        for (const change of addedChanges) {
          const sale = { id: change.doc.id, ...change.doc.data() };

          if (seenSaleIdsRef.current.has(sale.id)) {
            continue;
          }

          seenSaleIdsRef.current.add(sale.id);

          if (shouldNotifyRef.current && !shouldNotifyRef.current(sale)) {
            continue;
          }

          const message = buildMessageRef.current
            ? buildMessageRef.current(sale)
            : `Usuario realizó una venta con ID: ${sale.ticketNumber || sale.id}`;

          await notifySaleEvent({
            title: "Nueva venta registrada",
            message,
          });

          if (onSaleDetectedRef.current) {
            onSaleDetectedRef.current(sale);
          }
        }
      },
      (error) => {
        console.error("Error en listener de ventas en tiempo real:", error);
      },
    );

    return () => unsubscribe();
  }, [branchId, enabled]);
};
