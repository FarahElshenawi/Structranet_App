// ── API Client for StructuraNet AI ──────────────────────────────────────────
// Express backend: Auth + Chat management (port 3000)
// FastAPI backend: AI pipeline + SSE + GNS3 export (port 8000)

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
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth (Express) ───────────────────────────────────────────────────────────
export async function register({ name, email, password }) {
  return request(`${AUTH_URL}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login({ email, password }) {
  return request(`${AUTH_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getProfile() {
  return request(`${AUTH_URL}/auth/profile`);
}

// ── Chat History (Express) ───────────────────────────────────────────────────
export async function getChats() {
  return request(`${AUTH_URL}/chats`);
}

export async function getChat(chatId) {
  return request(`${AUTH_URL}/chats/${chatId}`);
}

export async function createChat({ title }) {
  return request(`${AUTH_URL}/chats`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function deleteChat(chatId) {
  return request(`${AUTH_URL}/chats/${chatId}`, { method: "DELETE" });
}

// ── FastAPI — AI Pipeline ────────────────────────────────────────────────────
export async function createSession() {
  return request(`${API_URL}/sessions`, { method: "POST" });
}

export async function startGeneration(sessionId, prompt) {
  return request(`${API_URL}/generate`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, prompt }),
  });
}

export async function editAndRegenerate(sessionId, edits) {
  return request(`${API_URL}/edit`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, edits }),
  });
}

export async function approveTopology(sessionId) {
  return request(`${API_URL}/approve`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// ── SSE Streaming ────────────────────────────────────────────────────────────
export function subscribeSSE(sessionId, onEvent, onError) {
  const url = `${API_URL}/stream/${sessionId}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
      if (data.type === "complete" || data.type === "error") {
        es.close();
      }
    } catch {
      // non-JSON message, ignore
    }
  };

  es.onerror = (err) => {
    if (onError) onError(err);
    es.close();
  };

  return es; // caller can close() it
}

// ── GNS3 Export ──────────────────────────────────────────────────────────────
export async function downloadGns3(sessionId) {
  const res = await fetch(`${API_URL}/download-gns3/${sessionId}`, {
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

// ── Topology JSON (direct) ──────────────────────────────────────────────────
export async function getTopology(sessionId) {
  return request(`${API_URL}/topology/${sessionId}`);
}
