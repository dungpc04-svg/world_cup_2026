import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithCustomToken, signOut as fbSignOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, functions, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = đang tải
  const [profile, setProfile] = useState(null); // dữ liệu doc users/{uid}
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [firebaseUser]);

  async function login(username, password) {
    const loginFn = httpsCallable(functions, 'login');
    const res = await loginFn({ username, password });
    const { token, mustChangePassword: mcp } = res.data;
    await signInWithCustomToken(auth, token);
    setMustChangePassword(mcp);
    return res.data;
  }

  async function logout() {
    await fbSignOut(auth);
    setMustChangePassword(false);
  }

  const value = {
    firebaseUser,
    profile,
    role: profile?.role || null,
    loading: firebaseUser === undefined,
    mustChangePassword: mustChangePassword || !!profile?.mustChangePassword,
    setMustChangePassword,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
