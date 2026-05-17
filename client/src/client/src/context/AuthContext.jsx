import { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin, register as apiRegister } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Try to restore user from localStorage
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  // We do NOT call getProfile() on mount because the Express backend
  // doesn't implement GET /api/auth/profile. Instead, we persist user
  // data in localStorage alongside the token.

  const login = useCallback(async ({ email, password }) => {
    const data = await apiLogin({ email, password });
    // Backend returns: { token, user: { id, username, email } }
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const registerUser = useCallback(async ({ username, email, password }) => {
    // Backend returns: { message: "User created successfully" }
    // No token returned on signup — auto-login after register
    await apiRegister({ username, email, password });
    // Auto-login after registration
    const loginData = await apiLogin({ email, password });
    localStorage.setItem("token", loginData.token);
    localStorage.setItem("user", JSON.stringify(loginData.user));
    setUser(loginData.user);
    return loginData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, registerUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
