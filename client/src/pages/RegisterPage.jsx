import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { NetworkIcon } from "../components/Icons";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BORDER = "#E5E7EB";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  color: "#111",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color .15s",
};

export default function RegisterPage({ onSwitchToLogin, onBack }) {
  const { registerUser } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerUser({ username, email, password });
    } catch (err) {
      setError(err.message || "Registration failed");
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
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 400,
          background: "white",
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          padding: 44,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 36,
          }}
        >
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
          <span style={{ fontWeight: 700, fontSize: 18, color: "#111" }}>
            StructuraNet AI
          </span>
        </div>

        <h1
          style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 6 }}
        >
          Create account
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28 }}>
          Start generating GNS3 topologies with AI
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
          {/* Username */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
          </div>

          {/* Terms */}
          <p
            style={{
              fontSize: 12,
              color: "#6B7280",
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            By creating an account, you agree to our{" "}
            <span style={{ color: PRIMARY, fontWeight: 500, cursor: "pointer" }}>
              Terms of Service
            </span>{" "}
            and{" "}
            <span style={{ color: PRIMARY, fontWeight: 500, cursor: "pointer" }}>
              Privacy Policy
            </span>
            .
          </p>

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
              fontFamily: "inherit",
            }}
            onMouseOver={(e) =>
              !loading && (e.currentTarget.style.background = PRIMARY_HOVER)
            }
            onMouseOut={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#6B7280",
            marginTop: 20,
          }}
        >
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            style={{
              background: "none",
              border: "none",
              color: PRIMARY,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          >
            Sign in
          </button>
        </p>

        {onBack && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button
              onClick={onBack}
              style={{
                background: "none",
                border: "none",
                color: "#9CA3AF",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            >
              Back to home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
