import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, register as apiRegister, getProfile } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check token on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      getProfile()
        .then((data) => setUser(data.user || data))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiLogin({ email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user || { email });
    return data;
  }, []);

  const registerUser = useCallback(async ({ name, email, password }) => {
    const data = await apiRegister({ name, email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user || { name, email });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, registerUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
