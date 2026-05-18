// ── API Client for StructuraNet AI ──────────────────────────────────────────
//
// Architecture:  React :5173 → Vite proxy → Express :3000 → FastAPI :8000
//
// Express handles:  Auth, Chat, Profile routes directly
// FastAPI handles:  AI sessions, SSE streaming, GNS3 export
//
// All /api/* requests use the Vite proxy (relative URLs).
// For SSE (EventSource), auth token is passed via ?token= query param
// since EventSource doesn't support custom headers.

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...options.headers },
    });
  } catch (networkErr) {
    // Network error — backend is not reachable
    throw new Error(
      "Unable to connect to the server. Please make sure both the Express backend (port 3000) " +
      "and the AI engine (port 8000) are running."
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Express backend uses { error: "..." }, FastAPI uses { detail: "..." }
    const rawMsg = body.error || body.detail || body.message || "";

    // Translate common HTTP status codes into user-friendly messages
    if (res.status === 401) {
      throw new Error("Session expired. Please sign in again.");
    }
    if (res.status === 404) {
      // Differentiate API 404 from route-not-found
      if (rawMsg) {
        throw new Error(rawMsg);
      }
      throw new Error(
        "The requested resource was not found. Please ensure the backend server is running on port 3000."
      );
    }
    if (res.status === 500) {
      throw new Error(
        rawMsg
          ? `Server error: ${rawMsg}. Check the backend console for details.`
          : "Internal server error. The AI engine may not be configured correctly. Check that the API key is set and the AI engine is running on port 8000."
      );
    }
    if (res.status === 502 || res.status === 503) {
      throw new Error(
        "The AI engine is unavailable. Please make sure the FastAPI server is running on port 8000."
      );
    }

    // Generic fallback
    throw new Error(rawMsg || `Request failed with status ${res.status}`);
  }
  return res.json();
}

// ── Auth (Express on port 3000, via Vite proxy) ──────────────────────────────

export async function register({ username, email, password }) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login({ email, password }) {
  return request("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Chat History (Express on port 3000, via Vite proxy) ──────────────────────

export async function getChats() {
  const data = await request("/api/userchats");
  return data.chats || data;
}

export async function getChat(chatId) {
  return request(`/api/chats/${chatId}`);
}

export async function createChat({ text, title }) {
  return request("/api/chats", {
    method: "POST",
    body: JSON.stringify({ text, title: title || text?.slice(0, 40) || "New Chat" }),
  });
}

export async function addMessage(chatId, messages) {
  return request(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

export async function deleteChat(chatId) {
  return request(`/api/chats/${chatId}`, { method: "DELETE" });
}

export async function updateChatSessionId(chatId, sessionId) {
  // Express doesn't have this route yet, so we use the chat update mechanism
  // This is non-critical — if it fails, the session just won't be linked to the chat
  try {
    return request(`/api/chats/${chatId}/session`, {
      method: "PUT",
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Non-critical — session linking is optional
    return null;
  }
}

// ── User Profile (Express on port 3000, via Vite proxy) ──────────────────────

export async function getUserProfile() {
  return request("/api/profile");
}

export async function updateUserProfile(profile) {
  return request("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

// ── FastAPI — AI Pipeline (via Vite proxy → Express → FastAPI :8000) ────────
//
// All /api/ai/* requests are proxied by Express to FastAPI :8000.
// The frontend calls /api/ai/... and Express handles forwarding,
// including SSE stream piping and file download streaming.

export async function createSession(profile = {}) {
  return request("/api/ai/sessions", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
}

export async function getSession(sessionId) {
  return request(`/api/ai/sessions/${sessionId}`);
}

export async function startGeneration(sessionId, prompt, projectName, securityProfile) {
  return request(`/api/ai/sessions/${sessionId}/generate`, {
    method: "POST",
    body: JSON.stringify({
      request: prompt,
      project_name: projectName || undefined,
      security_profile: securityProfile || "none",
    }),
  });
}

export async function editAndRegenerate(sessionId, feedback) {
  return request(`/api/ai/sessions/${sessionId}/edit`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function approveTopology(sessionId) {
  return request(`/api/ai/sessions/${sessionId}/approve`, {
    method: "POST",
  });
}

// ── SSE Streaming ────────────────────────────────────────────────────────────
//
// GET /api/ai/sessions/:id/events → EventSource with named events
//
// Uses query-param auth (?token=xxx) since the EventSource API
// does not support custom HTTP headers. The Express requireAuth
// middleware accepts tokens from both Authorization header and
// query parameter.
//
// Named SSE events from the pipeline:
//   phase_change     → { phase, sub_phase }
//   thought          → { id, type, content, timestamp }
//   config_text      → { device_name, device_type, chunk, start, done }
//   topology_ready   → TopologyData { name, nodes, links, node_count, link_count }
//   requirements_ready → [ RequiredAppliance ]
//   summary_ready    → TopologySummary { thinking_text, thoughts, design_review, assumptions }
//   phase2_progress  → { message }
//   export_progress  → { message }
//   complete         → { gns3project_ready, validator_passed }
//   error            → { error }
//   keepalive        → {}

export function subscribeSSE(sessionId, handlers = {}, onError) {
  const token = getToken();
  const url = `/api/ai/sessions/${sessionId}/events${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`;
  const es = new EventSource(url);

  const parse = (e) => {
    try {
      return JSON.parse(e.data);
    } catch {
      return {};
    }
  };

  // Register named event listeners — NOT es.onmessage (which misses named events)
  const eventNames = [
    "phase_change",
    "thought",
    "config_text",
    "topology_ready",
    "requirements_ready",
    "summary_ready",
    "phase2_progress",
    "export_progress",
    "complete",
    "error",
    "keepalive",
  ];

  eventNames.forEach((eventName) => {
    es.addEventListener(eventName, (e) => {
      const data = parse(e);
      if (handlers[eventName]) {
        handlers[eventName](data);
      }
      // Auto-close on terminal events that have data (not native EventSource errors)
      if (eventName === "complete") {
        es.close();
      }
      if (eventName === "error" && e.data) {
        es.close();
      }
    });
  });

  // Native EventSource error — connection lost or auth failure.
  // Only close on explicit errors, not reconnection attempts.
  es.onerror = (err) => {
    // EventSource auto-reconnects — only close if we have a critical error
    if (es.readyState === EventSource.CLOSED) {
      if (onError) onError(err);
    }
  };

  return es;
}

// ── Downloads (via Vite proxy → Express → FastAPI) ───────────────────────────
//
// All downloads go through the Express proxy → FastAPI pipeline.
// The helper triggers a browser download with the correct filename.

async function downloadFile(url, filename) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Download failed" }));
    throw new Error(err.detail || err.message || "Download failed");
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export async function downloadGns3(sessionId, projectName) {
  const filename = projectName
    ? `${projectName}.gns3project`
    : `${sessionId}.gns3project`;
  return downloadFile(`/api/ai/sessions/${sessionId}/download`, filename);
}

export async function downloadConfigsZip(sessionId, projectName) {
  const filename = projectName
    ? `${projectName}_configs.zip`
    : `${sessionId}_configs.zip`;
  return downloadFile(`/api/ai/sessions/${sessionId}/download/configs`, filename);
}

export async function downloadRequirements(sessionId, projectName) {
  const filename = projectName
    ? `${projectName}_requirements.json`
    : `${sessionId}_requirements.json`;
  return downloadFile(`/api/ai/sessions/${sessionId}/download/requirements`, filename);
}

// ── Topology JSON ────────────────────────────────────────────────────────────

export async function getTopology(sessionId) {
  return request(`/api/ai/sessions/${sessionId}/topology`);
}

// ── Requirements ────────────────────────────────────────────────────────────

export async function getRequirements(sessionId) {
  return request(`/api/ai/sessions/${sessionId}/requirements`);
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export async function getCatalog(catalogPath) {
  const params = catalogPath ? `?path=${encodeURIComponent(catalogPath)}` : "";
  return request(`/api/ai/catalog${params}`);
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck() {
  try {
    const res = await fetch("/api/health", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Backend connectivity check (lightweight, no auth needed) ────────────────

export async function checkBackendConnection() {
  try {
    const res = await fetch("/api/health", { method: "GET", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { connected: false, express: false, fastapi: false };
    // Express is up — check FastAPI via the AI health endpoint
    try {
      const aiRes = await fetch("/api/ai/health", { method: "GET", signal: AbortSignal.timeout(5000) });
      return { connected: true, express: true, fastapi: aiRes.ok };
    } catch {
      return { connected: true, express: true, fastapi: false };
    }
  } catch {
    return { connected: false, express: false, fastapi: false };
  }
}
