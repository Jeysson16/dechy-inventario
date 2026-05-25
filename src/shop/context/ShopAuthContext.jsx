/**
 * ShopAuthContext — Google OAuth for public shop customers.
 * Completely separate from the admin AuthContext.
 * Users sign in with Google to place orders.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";

const ShopAuthContext = createContext(null);

export const useShopAuth = () => {
  const ctx = useContext(ShopAuthContext);
  if (!ctx) throw new Error("useShopAuth must be used inside ShopAuthProvider");
  return ctx;
};

export const ShopAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      // Upsert customer record in Firestore
      const ref = doc(db, "shopCustomers", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: u.uid,
          email: u.email || "",
          displayName: u.displayName || "",
          photoURL: u.photoURL || null,
          nombre: u.displayName?.split(" ")[0] || "",
          apellidos: u.displayName?.split(" ").slice(1).join(" ") || "",
          celular: "",
          tipoDocumento: "",
          numeroDocumento: "",
          provider: "google",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          displayName: u.displayName || snap.data().displayName || "",
          photoURL: u.photoURL || snap.data().photoURL || null,
          updatedAt: serverTimestamp(),
        });
      }
      setAuthModal(false);
      return u;
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("[ShopAuth]", err);
      }
      return null;
    }
  }, []);

  const signOutShop = useCallback(() => signOut(auth), []);

  /** Call this to require login before a cart/checkout action. */
  const requireAuth = useCallback(
    (callback) => {
      if (user) {
        callback?.();
      } else {
        setAuthModal(true);
      }
    },
    [user],
  );

  return (
    <ShopAuthContext.Provider
      value={{
        user,
        loading,
        authModal,
        setAuthModal,
        signInWithGoogle,
        signOutShop,
        requireAuth,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </ShopAuthContext.Provider>
  );
};
