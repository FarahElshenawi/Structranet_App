import { Component } from "react";

const PRIMARY = "#166534";

/**
 * ChatErrorBoundary — wraps ChatPage to catch render errors.
 *
 * If ChatPage or any of its children throw during rendering, this
 * boundary catches the error and shows a recoverable UI instead of
 * crashing the entire app to a white screen. The user can retry
 * or reload the application.
 *
 * Usage:
 *   <ChatErrorBoundary>
 *     <ChatPage />
 *   </ChatErrorBoundary>
 */
export class ChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ChatErrorBoundary] Render error in ChatPage:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F9FAFB",
          fontFamily: "'Geist', system-ui, sans-serif",
          gap: 16,
          padding: 24,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "#FEF2F2",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, marginBottom: 4,
          }}>
            ⚠️
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>
            Chat page encountered an error
          </h1>
          <p style={{
            fontSize: 14, color: "#6B7280", maxWidth: 440,
            textAlign: "center", lineHeight: 1.6, margin: 0,
          }}>
            Something went wrong while rendering the chat interface. This has been logged
            to the console for debugging. You can retry or reload the application.
          </p>
          <code style={{
            fontSize: 12, fontFamily: "monospace",
            color: "#DC2626", background: "#FEF2F2",
            padding: "8px 14px", borderRadius: 6,
            border: "1px solid #FECACA",
            maxWidth: 440, wordBreak: "break-all",
            textAlign: "center",
          }}>
            {this.state.error?.message || "Unknown error"}
          </code>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px",
                border: `1px solid #E5E7EB`,
                background: "white",
                color: "#374151",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
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
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * TopologyErrorBoundary — wraps TopologyViewer to catch SVG/render errors.
 *
 * TopologyViewer does complex SVG rendering with force-directed layout
 * calculations that can throw if topology data is malformed. This
 * boundary catches those errors and shows a dismissable error panel
 * instead of crashing the entire chat page.
 *
 * Usage:
 *   <TopologyErrorBoundary onClose={handleClose}>
 *     <TopologyViewer topology={topology} ... />
 *   </TopologyErrorBoundary>
 */
export class TopologyErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[TopologyErrorBoundary] Render error in TopologyViewer:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "#F9FAFB",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "'Geist', system-ui, sans-serif",
          gap: 16, padding: 24,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "#FEF2F2",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, marginBottom: 4,
          }}>
            ⚠️
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: 0 }}>
            Topology viewer error
          </h1>
          <p style={{
            fontSize: 14, color: "#6B7280", maxWidth: 440,
            textAlign: "center", lineHeight: 1.6, margin: 0,
          }}>
            The topology diagram could not be rendered. The topology data may be
            malformed or incomplete. You can retry or go back to the chat.
          </p>
          <code style={{
            fontSize: 12, fontFamily: "monospace",
            color: "#DC2626", background: "#FEF2F2",
            padding: "8px 14px", borderRadius: 6,
            border: "1px solid #FECACA",
            maxWidth: 440, wordBreak: "break-all",
            textAlign: "center",
          }}>
            {this.state.error?.message || "Unknown error"}
          </code>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "10px 20px",
                border: `1px solid #E5E7EB`,
                background: "white",
                color: "#374151",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry Render
            </button>
            <button
              onClick={this.props.onClose || (() => this.setState({ hasError: false }))}
              style={{
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
              Back to Chat
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
