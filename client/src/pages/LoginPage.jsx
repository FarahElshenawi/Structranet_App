import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { NetworkIcon } from "../components/Icons";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BORDER = "#E5E7EB";

export default function LoginPage({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 380,
          background: "white",
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          padding: 40,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <NetworkIcon size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#111" }}>Structranet AI</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
          Sign in to continue generating network topologies
        </p>

        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              color: "#DC2626",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                color: "#111",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                color: "#111",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: PRIMARY,
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "12px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background .15s",
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.background = PRIMARY_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#6B7280" }}>
          Don't have an account?{" "}
          <button
            onClick={onSwitchToRegister}
            style={{
              background: "none",
              border: "none",
              color: PRIMARY,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
