import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import { ChatErrorBoundary } from "./components/ErrorBoundary";

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState("landing");

  if (user) {
    return (
      <ChatErrorBoundary>
        <ChatPage />
      </ChatErrorBoundary>
    );
  }

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
