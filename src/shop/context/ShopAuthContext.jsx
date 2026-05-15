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
import { auth } from "../../config/firebase";

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
      setAuthModal(false);
      return result.user;
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
