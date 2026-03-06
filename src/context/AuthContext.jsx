import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Firestore employee profile
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false); // true once Firestore profile fetch completes
  const [currentBranch, setCurrentBranch] = useState(() => {
    const saved = localStorage.getItem('inventory_current_branch');
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
        profileUnsub = onSnapshot(doc(db, 'employees', user.uid), (snap) => {
          if (snap.exists()) {
            const profile = { id: snap.id, ...snap.data() };
            setUserProfile(profile);

            // Non-admin users: auto-assign their branch from profile
            if (profile.role !== 'admin' && profile.branchId && profile.branchName) {
              const autoB = { id: profile.branchId, name: profile.branchName };
              setCurrentBranch(autoB);
              localStorage.setItem('inventory_current_branch', JSON.stringify(autoB));
            }
          } else {
            // No profile doc: treat as legacy admin (backward compat)
            setUserProfile(null);
          }
          setUserProfileLoaded(true);
          setAuthLoading(false);
        });
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

  const logout = () => {
    setCurrentBranch(null);
    setUserProfile(null);
    setUserProfileLoaded(false);
    localStorage.removeItem('inventory_current_branch');
    return signOut(auth);
  };

  const selectBranch = (branch) => {
    // Only admins can manually switch branches
    if (userProfile && userProfile.role !== 'admin') return;
    setCurrentBranch(branch);
    localStorage.setItem('inventory_current_branch', JSON.stringify(branch));
  };

  // Derived helpers
  const isAdmin = userProfile?.role === 'admin' || !userProfile; // legacy users are admin
  const userRole = userProfile?.role || 'admin';
  const displayName = userProfile?.name || currentUser?.email?.split('@')[0] || 'Usuario';

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
    logout,
    selectBranch,
  };

  return (
    <AuthContext.Provider value={value}>
      {!authLoading && children}
    </AuthContext.Provider>
  );
};
