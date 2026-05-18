import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ── Error Boundary ──────────────────────────────────────────────────────────────
// Catches runtime errors in the component tree that would otherwise cause a
// blank white page.  Displays a user-friendly fallback instead.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    // Clear potentially corrupt localStorage state and reload
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const msg =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error);

      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F9FAFB",
            fontFamily: "'Geist', system-ui, sans-serif",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              background: "white",
              borderRadius: 16,
              border: "1px solid #E5E7EB",
              padding: 40,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "#FEF2F2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                color: "#DC2626",
                fontSize: 24,
              }}
            >
              ⚠
            </div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#111",
                marginBottom: 8,
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#6B7280",
                lineHeight: 1.6,
                marginBottom: 8,
              }}
            >
              The application encountered an unexpected error. This has been
              logged to the console for debugging.
            </p>
            {msg && (
              <pre
                style={{
                  fontSize: 12,
                  color: "#DC2626",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  padding: "10px 14px",
                  textAlign: "left",
                  overflowX: "auto",
                  marginBottom: 20,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {msg}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 24px",
                border: "none",
                background: "#166534",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Mount ───────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
