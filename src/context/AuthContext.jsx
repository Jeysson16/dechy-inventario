import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';

const AuthContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // Renamed 'loading' to 'authLoading'
  const [currentBranch, setCurrentBranch] = useState(() => {
    // Try to restore branch from local storage on load
    const saved = localStorage.getItem('inventory_current_branch');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false); // Set authLoading to false after auth state is determined
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    setCurrentBranch(null);
    localStorage.removeItem('inventory_current_branch');
    return signOut(auth);
  };

  const selectBranch = (branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('inventory_current_branch', JSON.stringify(branch));
  };

  const value = {
    currentUser,
    currentBranch,
    authLoading, // Export authLoading
    login,
    logout,
    selectBranch,
  };

  return (
    <AuthContext.Provider value={value}>
      {!authLoading && children} {/* Use authLoading here */}
    </AuthContext.Provider>
  );
};
