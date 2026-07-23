import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Firestore employee profile
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false); // true once Firestore profile fetch completes
  const [currentBranch, setCurrentBranch] = useState(() => {
    const saved = localStorage.getItem("inventory_current_branch");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    let profileUnsub = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setUserProfileLoaded(false); // Reset while loading new profile

      // Clean up any previous profile listener
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (user) {
        // Listen to the employee profile in real-time
        profileUnsub = onSnapshot(
          doc(db, "employees", user.uid),
          (snap) => {
            if (snap.exists()) {
              const profile = { id: snap.id, ...snap.data() };
              setUserProfile(profile);

              // Non-admin users: auto-assign their branch from profile.
              // Some legacy employee docs have branchId without branchName.
              if (profile.role !== "admin" && profile.branchId) {
                const autoB = {
                  id: profile.branchId,
                  name: profile.branchName || "Sucursal asignada",
                };
                setCurrentBranch(autoB);
                localStorage.setItem(
                  "inventory_current_branch",
                  JSON.stringify(autoB),
                );

                if (!profile.branchName) {
                  getDoc(doc(db, "branches", profile.branchId))
                    .then((branchSnap) => {
                      if (!branchSnap.exists()) return;
                      const branch = branchSnap.data();
                      const hydratedBranch = {
                        id: branchSnap.id,
                        name: branch.name || autoB.name,
                      };
                      setCurrentBranch(hydratedBranch);
                      localStorage.setItem(
                        "inventory_current_branch",
                        JSON.stringify(hydratedBranch),
                      );
                    })
                    .catch((error) => {
                      console.error("Error fetching assigned branch:", error);
                    });
                }
              } else if (profile.role !== "admin") {
                setCurrentBranch(null);
                localStorage.removeItem("inventory_current_branch");
              }
            } else {
              // No profile doc: treat as legacy admin (backward compat)
              setUserProfile({
                id: user.uid,
                email: user.email,
                name: user.displayName || user.email?.split("@")[0] || "Admin",
                role: "admin",
                legacy: true,
              });
            }
            setUserProfileLoaded(true);
            setAuthLoading(false);
          },
          (error) => {
            console.error("Error fetching user profile:", error);
            setUserProfile(null);
            setUserProfileLoaded(true);
            setAuthLoading(false);
          },
        );
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserProfileLoaded(false);
        setAuthLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email, password, fullName, companyName) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    const user = userCredential.user;

    // Create company/brand doc (this is a simplified version for new users)
    const companyId = `comp_${Date.now()}`;
    await setDoc(doc(db, "companies", companyId), {
      name: companyName,
      createdAt: serverTimestamp(),
    });

    // Create primary employee profile (admin)
    await setDoc(doc(db, "employees", user.uid), {
      name: fullName,
      email: email,
      role: "admin",
      companyId: companyId,
      companyName: companyName,
      createdAt: serverTimestamp(),
    });

    return userCredential;
  };

  const logout = () => {
    setCurrentBranch(null);
    setUserProfile(null);
    setUserProfileLoaded(false);
    localStorage.removeItem("inventory_current_branch");
    return signOut(auth);
  };

  const updateUserProfile = async (profileUpdates) => {
    if (!currentUser) {
      throw new Error("Usuario no autenticado");
    }
    await setDoc(doc(db, "employees", currentUser.uid), profileUpdates, {
      merge: true,
    });
  };

  const selectBranch = (branch) => {
    // Only admins can manually switch branches
    if (userProfile && userProfile.role !== "admin") return;
    setCurrentBranch(branch);
    localStorage.setItem("inventory_current_branch", JSON.stringify(branch));
  };

  // Derived helpers
  const isAdmin = userProfile?.role === "admin";
  const userRole = userProfile?.role || "employee";
  const displayName =
    userProfile?.name || currentUser?.email?.split("@")[0] || "Usuario";

  const value = {
    currentUser,
    userProfile,
    userRole,
    isAdmin,
    displayName,
    currentBranch,
    authLoading,
    userProfileLoaded,
    login,
    register,
    logout,
    selectBranch,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!authLoading && children}
    </AuthContext.Provider>
  );
};
