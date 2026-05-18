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
 */
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
  const esRef = useRef(null);

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
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const startStream = useCallback((sessionId) => {
    reset();
    setStatus("streaming");
    setPhase("generating");
    setSubPhase("thinking");

    const handlers = {
      // { phase, sub_phase } — drives all UI state transitions
      phase_change: ({ phase: p, sub_phase }) => {
        setPhase(p);
        setSubPhase(sub_phase || null);
        if (p === "review")    setStatus("review");
        if (p === "exporting") setStatus("exporting");
        if (p === "success")   setStatus("complete");
        if (p === "error")     setStatus("error");
      },

      // { id, type, content, timestamp } — type: understanding|decision|assumption|warning
      thought: (data) => {
        setThoughts((prev) => [...prev, data]);
      },

      // TopologyData — fires when Phase 1 is done; moves to review, NOT complete
      topology_ready: (data) => {
        setTopology(data);
        // Only advance to review if we haven't already gotten a phase_change
        setStatus((s) => (s === "streaming" ? "review" : s));
        setPhase((p) => (p === "generating" ? "review" : p));
      },

      requirements_ready: (data) => {
        setRequirements(data);
      },

      summary_ready: (data) => {
        setSummary(data);
      },

      // { status: "generating_configs" }
      phase2_progress: ({ status: s }) => {
        setSubPhase(s || "streaming_configs");
      },

      // { step: "exporting" | "validating" }
      export_progress: ({ step }) => {
        setSubPhase(step);
      },

      // { device_name, device_type, chunk, start, done }
      // 6-char chunks streamed at 20ms intervals from pipeline.py
      config_text: ({ device_name, chunk, start, done }) => {
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
      },

      // ExportResponse — THE ONLY event that sets status to "complete"
      complete: (data) => {
        setExportData(data);
        setStatus("complete");
        setPhase("success");
        setSubPhase(null);
      },

      // { message, phase }
      error: ({ message }) => {
        setStatus("error");
        setPhase("error");
        setSubPhase(null);
        console.error("[SSE] pipeline error:", message);
      },

      keepalive: () => {
        // heartbeat — no-op
      },
    };

    esRef.current = subscribeSSE(sessionId, handlers, () => {
      // Connection dropped unexpectedly (not a normal close)
      setStatus((s) => (s === "streaming" || s === "exporting" ? "error" : s));
    });
  }, [reset]);

  const stopStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

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
    // Actions
    startStream,
    stopStream,
    reset,
  };
}
