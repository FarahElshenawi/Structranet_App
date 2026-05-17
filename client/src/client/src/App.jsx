import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState("login"); // login | register | chat

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
