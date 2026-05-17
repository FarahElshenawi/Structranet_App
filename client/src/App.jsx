import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";

const BORDER = "#E5E7EB";

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState("login"); // login | register | chat

  // Still checking token
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

  // Not authenticated → Login / Register
  if (page === "register") {
    return <RegisterPage onSwitchToLogin={() => setPage("login")} />;
  }

  return (
    <LoginPage onSwitchToRegister={() => setPage("register")} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
