import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState("landing"); // landing | login | register | chat

  // Still checking auth state (e.g. during login/register/demo)
  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F9FAFB",
          fontFamily: "'Geist', system-ui, sans-serif",
          color: "#6B7280",
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    );
  }

  // Authenticated → Chat
  if (user) {
    return <ChatPage />;
  }

  // Not authenticated → Landing / Login / Register
  if (page === "login") {
    return <LoginPage onSwitchToRegister={() => setPage("register")} onBack={() => setPage("landing")} />;
  }

  if (page === "register") {
    return <RegisterPage onSwitchToLogin={() => setPage("login")} onBack={() => setPage("landing")} />;
  }

  return (
    <LandingPage
      onLogin={() => setPage("login")}
      onSignup={() => setPage("register")}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
