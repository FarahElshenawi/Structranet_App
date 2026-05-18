// ── API Client for StructuraNet AI ──────────────────────────────────────────
// Proxy chain: React :5173 → Vite proxy /api → Express :3000 → /api/ai → FastAPI :8000
// All requests use relative URLs through the Vite proxy.

function getToken() {
  return localStorage.getItem("token");
}

function authHeaders(extra = {}) {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, ...extra } : extra;
}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw new Error(`Network error — is the server running?\n${err.message}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error || body.detail || body.message;
    const detail = typeof msg === "string" ? msg : JSON.stringify(msg);
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Auth (Express /api/auth/*) ───────────────────────────────────────────────
export async function login({ email, password }) {
  return request("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register({ username, email, password }) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function demoLogin() {
  return request("/api/auth/demo", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ─── Chat history (Express /api/*) ────────────────────────────────────────────
export async function getChats() {
  const data = await request("/api/userchats");
  return Array.isArray(data) ? data : (data.chats || []);
}

export async function getChat(chatId) {
  return request(`/api/chats/${chatId}`);
}

export async function createChat({ text }) {
  return request("/api/chats", {
    method: "POST",
    body: JSON.stringify({ text, title: text.slice(0, 60) }),
  });
}

export async function updateChatSessionId(chatId, sessionId) {
  try {
    return await request(`/api/chats/${chatId}/session`, {
      method: "PUT",
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    return null; // non-critical
  }
}

export async function deleteChat(chatId) {
  return request(`/api/chats/${chatId}`, { method: "DELETE" });
}

// ─── User profile (Express /api/profile) ─────────────────────────────────────
export async function getUserProfile() {
  return request("/api/profile");
}

export async function updateUserProfile(profile) {
  return request("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

// ─── FastAPI Sessions (via Vite → Express → /api/ai → FastAPI) ───────────────
//
// FIX: FastAPI CreateSessionRequest requires { profile: { ... } }.
// Sending {} gives 422 Unprocessable Entity.
// profile.images array must be mapped to template_image_map dict.
export async function createSession(profileFromUser = {}) {
  const imageMap = {};
  if (Array.isArray(profileFromUser.images)) {
    for (const img of profileFromUser.images) {
      if (img.name && img.filename) imageMap[img.name] = img.filename;
    }
  }

  return request("/api/ai/sessions", {
    method: "POST",
    body: JSON.stringify({
      profile: {
        gns3_version: profileFromUser.version || "2.2",
        supports_iou: profileFromUser.features?.iou ?? false,
        supports_qemu: profileFromUser.features?.qemu ?? true,
        supports_docker: profileFromUser.features?.docker ?? false,
        strict_validation: true,
        require_template_image_map: false,
        template_image_map: Object.keys(imageMap).length > 0 ? imageMap : null,
        security_profile: profileFromUser.security_profile || "none",
      },
    }),
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
      project_name: projectName || null,
      security_profile: securityProfile || "none",
    }),
  });
}

export async function editTopology(sessionId, feedback) {
  return request(`/api/ai/sessions/${sessionId}/edit`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
}

export async function approveTopology(sessionId) {
  return request(`/api/ai/sessions/${sessionId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ─── SSE Streaming ────────────────────────────────────────────────────────────
// FIX: EventSource cannot set custom headers.
// Pass JWT token as ?token= query param — Express requireAuth accepts it.
// MUST use addEventListener per event name, NOT onmessage (misses named events).
export function subscribeSSE(sessionId, handlers, onConnectionError) {
  const token = getToken();
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const url = `/api/ai/sessions/${sessionId}/events${qs}`;
  const es  = new EventSource(url);

  const EVENTS = [
    "phase_change", "thought", "topology_ready", "requirements_ready",
    "summary_ready", "phase2_progress", "export_progress", "config_text",
    "complete", "error", "keepalive",
  ];

  EVENTS.forEach((name) => {
    es.addEventListener(name, (e) => {
      try {
        const data = JSON.parse(e.data);
        handlers[name]?.(data);
        if (name === "complete" || name === "error") {
          setTimeout(() => es.close(), 100);
        }
      } catch {
        // ignore non-JSON keepalive ticks
      }
    });
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) onConnectionError?.();
  };

  return es;
}

// ─── Downloads ────────────────────────────────────────────────────────────────
async function downloadBlob(url, filename) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const blob    = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = blobUrl;
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export const downloadGns3 = (sid, name = "network") =>
  downloadBlob(`/api/ai/sessions/${sid}/download`, `${name}.gns3project`);

export const downloadConfigsZip = (sid, name = "network") =>
  downloadBlob(`/api/ai/sessions/${sid}/download/configs`, `${name}_configs.zip`);

export const downloadRequirements = (sid, name = "network") =>
  downloadBlob(`/api/ai/sessions/${sid}/download/requirements`, `${name}_requirements.json`);

// ─── Health ───────────────────────────────────────────────────────────────────
/**
 * Create an AbortSignal with a timeout in a cross-browser compatible way.
 * Falls back gracefully if AbortSignal.timeout is not available.
 */
function createTimeoutSignal(ms) {
  try {
    if (typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
  } catch {
    // AbortSignal.timeout not supported
  }
  // Fallback: use AbortController with manual setTimeout
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function checkBackendHealth() {
  try {
    const express = await fetch("/api/health", {
      signal: createTimeoutSignal(4000),
    }).then((r) => r.ok).catch(() => false);

    const fastapi = await fetch("/api/ai/health", {
      signal: createTimeoutSignal(4000),
    }).then((r) => r.ok).catch(() => false);

    return { express, fastapi };
  } catch {
    return { express: false, fastapi: false };
  }
}
