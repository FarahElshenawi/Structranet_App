// ── API Client for StructuraNet AI ──────────────────────────────────────────
// Express backend: Auth + Chat management (port 3000)
// FastAPI backend: AI pipeline + SSE + GNS3 export (port 8000)
//
// All URLs match the ACTUAL backend routes:
//   Express: /api/auth/signup, /api/auth/signin, /api/chats, /api/userchats
//   FastAPI: /api/sessions, /api/sessions/{id}/generate, etc.

const AUTH_URL = import.meta.env.VITE_AUTH_URL || "http://localhost:3000";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
    throw new Error(
      `Cannot reach server at ${url}. Make sure the backend is running.\n` +
      `Original error: ${networkErr.message}`
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Express backend uses { error: "..." }, FastAPI uses { detail: "..." }
    const msg = body.error || body.detail || body.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

// ── Auth (Express on port 3000) ─────────────────────────────────────────────
// Backend routes: POST /api/auth/signup, POST /api/auth/signin

export async function register({ username, email, password }) {
  // Backend expects { username, email, password } and returns { message }
  return request(`${AUTH_URL}/api/auth/signup`, {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login({ email, password }) {
  // Backend expects { email, password } and returns { token, user: { id, username, email } }
  return request(`${AUTH_URL}/api/auth/signin`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Chat History (Express on port 3000) ─────────────────────────────────────
// Backend routes: GET /api/userchats, POST /api/chats, GET /api/chats/:chatId,
//                 POST /api/chats/:chatId/messages

export async function getChats() {
  // Returns { chats: [...] } — each item has _id, userId, chatId, title, createdAt
  return request(`${AUTH_URL}/api/userchats`);
}

export async function getChat(chatId) {
  // Returns Chat object with messages
  return request(`${AUTH_URL}/api/chats/${chatId}`);
}

export async function createChat({ text }) {
  // Backend expects { text, images?: [] } for the first message
  return request(`${AUTH_URL}/api/chats`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function addMessage(chatId, messages) {
  // Append messages to existing chat
  return request(`${AUTH_URL}/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

export async function deleteChat(chatId) {
  return request(`${AUTH_URL}/api/chats/${chatId}`, { method: "DELETE" });
}

// ── FastAPI — AI Pipeline (port 8000) ───────────────────────────────────────
// All routes are under /api/sessions/{id}/...

export async function createSession(profile) {
  // POST /api/sessions — returns { session_id, status, profile, inventory }
  return request(`${API_URL}/api/sessions`, {
    method: "POST",
    body: JSON.stringify(profile || {}),
  });
}

export async function getSession(sessionId) {
  // GET /api/sessions/{id} — returns SessionStatus
  return request(`${API_URL}/api/sessions/${sessionId}`);
}

export async function startGeneration(sessionId, prompt, projectName, securityProfile) {
  // POST /api/sessions/{id}/generate — session_id goes in URL, not body
  return request(`${API_URL}/api/sessions/${sessionId}/generate`, {
    method: "POST",
    body: JSON.stringify({
      request: prompt,           // backend expects field "request", not "prompt"
      project_name: projectName,
      security_profile: securityProfile || "none",
    }),
  });
}

export async function editAndRegenerate(sessionId, feedback) {
  // POST /api/sessions/{id}/edit — backend expects { feedback }, not { edits }
  return request(`${API_URL}/api/sessions/${sessionId}/edit`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function approveTopology(sessionId) {
  // POST /api/sessions/{id}/approve — no body needed, session_id is in URL
  return request(`${API_URL}/api/sessions/${sessionId}/approve`, {
    method: "POST",
  });
}

// ── SSE Streaming ────────────────────────────────────────────────────────────
// GET /api/sessions/{id}/events — SSE with NAMED events
// Event types: phase_change, thought, topology_ready, requirements_ready,
//              summary_ready, phase2_progress, export_progress, complete, error, keepalive

export function subscribeSSE(sessionId, handlers, onError) {
  const url = `${API_URL}/api/sessions/${sessionId}/events`;
  const es = new EventSource(url);

  // Register named event listeners — NOT es.onmessage (which misses named events)
  const eventNames = [
    "phase_change",
    "thought",
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
      try {
        const data = JSON.parse(e.data);
        if (handlers[eventName]) {
          handlers[eventName](data);
        }
        // Auto-close on terminal events
        if (eventName === "complete" || eventName === "error") {
          es.close();
        }
      } catch {
        // non-JSON data, ignore
      }
    });
  });

  es.onerror = (err) => {
    if (onError) onError(err);
    es.close();
  };

  return es;
}

// ── GNS3 Export ──────────────────────────────────────────────────────────────
// GET /api/sessions/{id}/download — returns .gns3project zip

export async function downloadGns3(sessionId) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/download`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sessionId}.gns3project`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Topology JSON ───────────────────────────────────────────────────────────
// GET /api/sessions/{id}/topology

export async function getTopology(sessionId) {
  return request(`${API_URL}/api/sessions/${sessionId}/topology`);
}

// ── Requirements ────────────────────────────────────────────────────────────
// GET /api/sessions/{id}/requirements

export async function getRequirements(sessionId) {
  return request(`${API_URL}/api/sessions/${sessionId}/requirements`);
}

// ── Catalog ─────────────────────────────────────────────────────────────────
// GET /api/catalog

export async function getCatalog(catalogPath) {
  const params = catalogPath ? `?path=${encodeURIComponent(catalogPath)}` : "";
  return request(`${API_URL}/api/catalog${params}`);
}

// ── Health ──────────────────────────────────────────────────────────────────
// GET /api/health

export async function healthCheck() {
  return request(`${API_URL}/api/health`);
}
