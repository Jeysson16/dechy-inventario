import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentBranch, setCurrentBranch] = useState(() => {
    // Try to restore branch from local storage on load
    const saved = localStorage.getItem('inventory_current_branch');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
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
    login,
    logout,
    selectBranch,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
