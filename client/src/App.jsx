import { useState, Component } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import { ChatErrorBoundary } from "./components/ErrorBoundary";

const BORDER = "#E5E7EB";
const PRIMARY = "#166534";

// ── Error Boundary: catches render crashes and shows a recoverable UI ──
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] React render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#F9FAFB",
            fontFamily: "'Geist', system-ui, sans-serif",
            gap: 16,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", maxWidth: 480, textAlign: "center", lineHeight: 1.6, margin: 0 }}>
            The application encountered an unexpected error. This has been logged to the console for debugging.
          </p>
          <code
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              color: "#DC2626",
              background: "#FEF2F2",
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #FECACA",
              maxWidth: 480,
              wordBreak: "break-all",
              textAlign: "center",
            }}
          >
            {this.state.error?.message || "Unknown error"}
          </code>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: 8,
              padding: "10px 24px",
              border: "none",
              background: PRIMARY,
              color: "white",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user } = useAuth();
  const [page, setPage] = useState("landing"); // landing | login | register | chat

  // Authenticated → Chat (wrapped in its own error boundary)
  if (user) {
    return (
      <ChatErrorBoundary>
        <ChatPage />
      </ChatErrorBoundary>
    );
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
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
