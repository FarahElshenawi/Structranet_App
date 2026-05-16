/**
 * api.js — StructuraNet AI FastAPI Client
 *
 * Connects the React frontend to the Python FastAPI backend (port 8000).
 * Handles sessions, generation, SSE streaming, topology, and GNS3 export.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ═══════════════════════════════════════════════════════════════════════════════
//  Sessions
// ═══════════════════════════════════════════════════════════════════════════════

export async function createSession(profile = {}) {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile: {
        gns3_version: profile.gns3_version || "2.2",
        supports_iou: profile.supports_iou || false,
        supports_qemu: profile.supports_qemu !== false,
        supports_docker: profile.supports_docker || false,
        strict_validation: profile.strict_validation !== false,
        security_profile: profile.security_profile || "none",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Create session failed (${res.status})`);
  }
  return res.json();
}

export async function getSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Session not found (${res.status})`);
  return res.json();
}

export async function deleteSession(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Generation
// ═══════════════════════════════════════════════════════════════════════════════

export async function startGeneration(sessionId, request, securityProfile = "none") {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request,
      security_profile: securityProfile,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Generate failed (${res.status})`);
  }
  return res.json();
}

export async function editTopology(sessionId, feedback) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Edit failed (${res.status})`);
  }
  return res.json();
}

export async function approveTopology(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Approve failed (${res.status})`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SSE Event Stream
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribe to SSE events for a session.
 * Returns a cleanup function to close the connection.
 *
 * @param {string} sessionId
 * @param {Object} handlers - Event handler callbacks
 * @param {function} handlers.onPhaseChange - (data) => {}
 * @param {function} handlers.onThought - (data) => {}
 * @param {function} handlers.onTopologyReady - (data) => {}
 * @param {function} handlers.onRequirementsReady - (data) => {}
 * @param {function} handlers.onSummaryReady - (data) => {}
 * @param {function} handlers.onExportProgress - (data) => {}
 * @param {function} handlers.onComplete - (data) => {}
 * @param {function} handlers.onError - (data) => {}
 * @param {function} handlers.onKeepalive - () => {}
 * @returns {function} cleanup - Call to close EventSource
 */
export function subscribeToSession(sessionId, handlers = {}) {
  const url = `${API_BASE}/api/sessions/${sessionId}/events`;
  const es = new EventSource(url);

  const eventMap = {
    phase_change: handlers.onPhaseChange,
    thought: handlers.onThought,
    topology_ready: handlers.onTopologyReady,
    requirements_ready: handlers.onRequirementsReady,
    summary_ready: handlers.onSummaryReady,
    export_progress: handlers.onExportProgress,
    phase2_progress: handlers.onPhase2Progress,
    complete: handlers.onComplete,
    error: handlers.onError,
    keepalive: handlers.onKeepalive,
  };

  Object.entries(eventMap).forEach(([event, handler]) => {
    if (handler) {
      es.addEventListener(event, (e) => {
        try {
          const data = JSON.parse(e.data);
          handler(data);
        } catch {
          handler(e.data);
        }
      });
    }
  });

  es.onerror = (e) => {
    if (handlers.onConnectionError) {
      handlers.onConnectionError(e);
    }
  };

  return () => {
    es.close();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Data Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

export async function getTopology(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/topology`);
  if (!res.ok) throw new Error(`Topology not available (${res.status})`);
  return res.json();
}

export async function getRequirements(sessionId) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/requirements`);
  if (!res.ok) return [];
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Downloads
// ═══════════════════════════════════════════════════════════════════════════════

export function getDownloadUrl(sessionId) {
  return `${API_BASE}/api/sessions/${sessionId}/download`;
}

export function getJsonDownloadUrl(sessionId) {
  return `${API_BASE}/api/sessions/${sessionId}/download/json`;
}

export async function downloadGns3Project(sessionId) {
  const url = getDownloadUrl(sessionId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition");
  let filename = "topology.gns3project";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+?)"?$/);
    if (match) filename = match[1];
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export async function downloadTopologyJson(sessionId) {
  const url = getJsonDownloadUrl(sessionId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JSON download failed (${res.status})`);

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "topology.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Catalog
// ═══════════════════════════════════════════════════════════════════════════════

export async function getCatalog() {
  const res = await fetch(`${API_BASE}/api/catalog`);
  if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Health
// ═══════════════════════════════════════════════════════════════════════════════

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) return { status: "error" };
    return res.json();
  } catch {
    return { status: "offline" };
  }
}
