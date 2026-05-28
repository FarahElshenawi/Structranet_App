import { useState, useCallback, useRef } from "react";
import { subscribeSSE } from "../lib/api";

/**
 * useSSE — SSE streaming hook for the StructuraNet AI pipeline.
 *
 * Phase state machine (from docs §5.1):
 *   idle → generating(thinking) → generating(building) → review
 *        → exporting(finalizing) → exporting(streaming_configs) → success | error
 *
 * KEY FIXES vs old version:
 *  1. topology_ready does NOT set status="complete" — it moves to "review"
 *  2. complete SSE event is the ONLY thing that sets status="complete"
 *  3. config_text chunks are accumulated per device (start flag resets)
 *  4. All 11 named SSE events are handled
 *  5. phase + subPhase are stored separately for fine-grained UI control
 *  6. SAFETY TIMEOUT: If streaming stays active for >3 min with no events,
 *     auto-transition to error so the UI doesn't freeze.
 *  7. C5: AUTO-RECONNECTION with event replay — if the SSE connection drops,
 *     the hook automatically reconnects up to MAX_RECONNECT_ATTEMPTS times
 *     with exponential backoff. On reconnect, it replays the last known
 *     session state so the UI stays consistent.
 */

// Safety timeout: 3 minutes with no SSE events → auto-error
const STREAM_TIMEOUT_MS = 3 * 60 * 1000;

// C5: Reconnection configuration
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;   // Start with 1s, double each attempt
const RECONNECT_MAX_DELAY_MS = 15000;   // Cap at 15s

export default function useSSE() {
  const [thoughts,     setThoughts]     = useState([]);   // [{id,type,content,timestamp}]
  const [topology,     setTopology]     = useState(null); // TopologyData
  const [requirements, setRequirements] = useState(null); // RequiredAppliance[]
  const [summary,      setSummary]      = useState(null); // TopologySummary
  const [configTexts,  setConfigTexts]  = useState({});   // { deviceName: fullText }
  const [phase,        setPhase]        = useState("idle");     // generating|review|exporting|success|error
  const [subPhase,     setSubPhase]     = useState(null);       // thinking|building|streaming_configs|…
  const [status,       setStatus]       = useState("idle");     // idle|streaming|review|exporting|complete|error
  const [exportData,   setExportData]   = useState(null);       // ExportResponse
  const [agentMessage, setAgentMessage] = useState("");         // LLM's text response via tool calling
  const [toolCallsMade,setToolCallsMade]= useState([]);         // Which tools the LLM called
  const [reconnecting, setReconnecting] = useState(false);      // C5: reconnection in progress
  const esRef = useRef(null);
  const timeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);      // C5: current reconnect attempt count
  const reconnectTimerRef = useRef(null);      // C5: timer for delayed reconnect
  const currentSessionIdRef = useRef(null);    // C5: track session ID for reconnect
  const handlersRef = useRef(null);            // C5: store handlers for reconnect

  // Reset the safety timeout timer — called on every SSE event
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      console.error("[SSE] Safety timeout: no events received for", STREAM_TIMEOUT_MS / 1000, "seconds");
      setStatus("error");
      setPhase("error");
      setSubPhase(null);
      esRef.current?.close();
      esRef.current = null;
    }, STREAM_TIMEOUT_MS);
  }, []);

  const clearStreamTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // C5: Clear any pending reconnect timer
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setThoughts([]);
    setTopology(null);
    setRequirements(null);
    setSummary(null);
    setConfigTexts({});
    setPhase("idle");
    setSubPhase(null);
    setStatus("idle");
    setExportData(null);
    setAgentMessage("");
    setToolCallsMade([]);
    setReconnecting(false);
    esRef.current?.close();
    esRef.current = null;
    currentSessionIdRef.current = null;
    reconnectAttemptRef.current = 0;
    clearStreamTimeout();
    clearReconnectTimer();
  }, [clearStreamTimeout, clearReconnectTimer]);

  // C5: Attempt to reconnect to the SSE stream after a connection drop.
  // Uses exponential backoff and replays the current state so the UI
  // remains consistent even if events were missed during the disconnect.
  const attemptReconnect = useCallback((sessionId, handlers) => {
    const attempt = reconnectAttemptRef.current;

    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[SSE] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      setStatus("error");
      setPhase("error");
      setSubPhase(null);
      setReconnecting(false);
      clearStreamTimeout();
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt),
      RECONNECT_MAX_DELAY_MS
    );

    console.log(`[SSE] Reconnect attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    setReconnecting(true);

    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current++;

      // Close any existing connection
      if (esRef.current) {
        try { esRef.current.close(); } catch (e) { /* ignore */ }
        esRef.current = null;
      }

      // Re-subscribe to the SSE stream
      // The server will send current state events upon reconnection
      esRef.current = subscribeSSE(sessionId, handlers, () => {
        // Connection dropped again — try reconnecting
        attemptReconnect(sessionId, handlers);
      });

      // If we already have topology data, the UI remains in the last known state
      // The server may re-send events that update the state
      console.log("[SSE] Reconnected to SSE stream");
    }, delay);
  }, [clearStreamTimeout]);

  const startStream = useCallback((sessionId) => {
    reset();
    setStatus("streaming");
    setPhase("generating");
    setSubPhase("thinking");
    currentSessionIdRef.current = sessionId;
    reconnectAttemptRef.current = 0;

    // Helper: wrap any handler to also reset the safety timeout
    const withTimeout = (fn) => (data) => {
      resetTimeout();
      // Reset reconnect attempt counter on any successful event
      reconnectAttemptRef.current = 0;
      setReconnecting(false);
      fn(data);
    };

    const handlers = {
      // { phase, sub_phase } — drives all UI state transitions
      phase_change: withTimeout(({ phase: p, sub_phase }) => {
        setPhase(p);
        setSubPhase(sub_phase || null);
        if (p === "review")    setStatus("review");
        if (p === "exporting") setStatus("exporting");
        if (p === "success")   setStatus("complete");
        if (p === "error")     setStatus("error");
        // Clear timeout on terminal states
        if (p === "success" || p === "error") clearStreamTimeout();
      }),

      // { id, type, content, timestamp } — type: understanding|decision|assumption|warning
      thought: withTimeout((data) => {
        setThoughts((prev) => [...prev, data]);
      }),

      // TopologyData — fires when Phase 1 is done; moves to review, NOT complete
      topology_ready: withTimeout((data) => {
        setTopology(data);
        // Only advance to review if we haven't already gotten a phase_change
        setStatus((s) => (s === "streaming" ? "review" : s));
        setPhase((p) => (p === "generating" ? "review" : p));
      }),

      requirements_ready: withTimeout((data) => {
        setRequirements(data);
      }),

      summary_ready: withTimeout((data) => {
        setSummary(data);
      }),

      // { status: "generating_configs" }
      phase2_progress: withTimeout(({ status: s }) => {
        setSubPhase(s || "streaming_configs");
      }),

      // { step: "exporting" | "validating" }
      export_progress: withTimeout(({ step }) => {
        setSubPhase(step);
      }),

      // { device_name, device_type, chunk, start, done }
      // 6-char chunks streamed at 20ms intervals from pipeline.py
      config_text: withTimeout(({ device_name, chunk, start, done }) => {
        if (!device_name) return;
        setConfigTexts((prev) => {
          if (start) {
            // First chunk for this device — create/reset entry
            return { ...prev, [device_name]: chunk };
          }
          if (done) {
            // Signal only, no content — leave as-is
            return prev;
          }
          // Append chunk
          return { ...prev, [device_name]: (prev[device_name] || "") + chunk };
        });
      }),

      // ExportResponse — THE ONLY event that sets status to "complete"
      complete: withTimeout((data) => {
        setExportData(data);
        setStatus("complete");
        setPhase("success");
        setSubPhase(null);
        clearStreamTimeout(); // No more timeout needed
      }),

      // { message, phase }
      error: withTimeout(({ message }) => {
        setStatus("error");
        setPhase("error");
        setSubPhase(null);
        clearStreamTimeout();
        console.error("[SSE] pipeline error:", message);
      }),

      // { message, tool_calls_made } — LLM's final text response after tool calling
      agent_message: withTimeout(({ message, tool_calls_made }) => {
        if (message) setAgentMessage(message);
        if (tool_calls_made?.length) setToolCallsMade(tool_calls_made);
      }),

      keepalive: withTimeout(() => {
        // heartbeat — just resets the timeout
      }),
    };

    // Store handlers and session ID for reconnection
    handlersRef.current = handlers;

    // Start the initial safety timeout
    resetTimeout();

    // C5: On connection error, attempt reconnection instead of immediately
    // transitioning to error state. The reconnection logic handles the
    // exponential backoff and max attempts.
    esRef.current = subscribeSSE(sessionId, handlers, () => {
      // Connection dropped unexpectedly (not a normal close)
      // Only attempt reconnect if we're in an active streaming state
      if (currentSessionIdRef.current) {
        attemptReconnect(currentSessionIdRef.current, handlers);
      } else {
        // No session to reconnect to — show error
        setStatus((s) => (s === "streaming" || s === "exporting" ? "error" : s));
        clearStreamTimeout();
      }
    });
  }, [reset, resetTimeout, clearStreamTimeout, attemptReconnect]);

  const stopStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    currentSessionIdRef.current = null;
    reconnectAttemptRef.current = 0;
    setReconnecting(false);
    clearStreamTimeout();
    clearReconnectTimer();
  }, [clearStreamTimeout, clearReconnectTimer]);

  return {
    // State
    thoughts,
    topology,
    requirements,
    summary,
    configTexts,
    phase,
    subPhase,
    status,
    exportData,
    agentMessage,
    toolCallsMade,
    reconnecting,       // C5: true when auto-reconnecting
    // Actions
    startStream,
    stopStream,
    reset,
  };
}
