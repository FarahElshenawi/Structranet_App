import { useState, useCallback, useRef } from "react";
import { subscribeSSE } from "../lib/api";

/**
 * Hook for SSE streaming from FastAPI.
 * Uses NAMED events from the backend:
 *   phase_change, thought, config_text, topology_ready, requirements_ready,
 *   summary_ready, phase2_progress, export_progress, complete, error, keepalive
 *
 * Returns { thoughts, configTexts, topology, requirements, summary, phase, status,
 *           startStream, stopStream, reset }
 *
 * phase: { phase, sub_phase } | null
 *   phase: "generating" | "review" | "exporting" | "success" | "error"
 *   sub_phase: "building" | "generating_configs" | "validating" | null
 */
export default function useSSE() {
  const [thoughts, setThoughts] = useState([]);
  const [configTexts, setConfigTexts] = useState({}); // { deviceName: accumulatedText }
  const [topology, setTopology] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | streaming | complete | error
  const [phase, setPhase] = useState(null); // { phase, sub_phase }
  const esRef = useRef(null);

  const reset = useCallback(() => {
    setThoughts([]);
    setConfigTexts({});
    setTopology(null);
    setRequirements(null);
    setSummary(null);
    setStatus("idle");
    setPhase(null);
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const startStream = useCallback((sessionId) => {
    reset();
    setStatus("streaming");

    const handlers = {
      phase_change: (data) => {
        // data: { phase, sub_phase }
        setPhase(data);
      },

      thought: (data) => {
        // data: { id, type, content, timestamp }
        setThoughts((prev) => [...prev, data]);
      },

      config_text: (data) => {
        // data: { device_name, device_type, chunk, start, done }
        // Also support: { device, chunk, is_start, is_first }
        const device = data.device_name || data.device || "device";
        const chunk = data.chunk || "";
        const isStart = data.start || data.is_start || data.is_first;

        setConfigTexts((prev) => {
          if (isStart) {
            // First chunk for this device — replace
            return { ...prev, [device]: chunk };
          }
          // Subsequent chunks — append
          const existing = prev[device] || "";
          return { ...prev, [device]: existing + chunk };
        });
      },

      topology_ready: (data) => {
        // data: { name, nodes: [...], links: [...], node_count, link_count }
        setTopology(data);
      },

      requirements_ready: (data) => {
        // data: [{ node_id, name, node_type, template_name, category, image_required, image_file, status }]
        setRequirements(data);
      },

      summary_ready: (data) => {
        // data: { thinking_text, thoughts, design_review, assumptions }
        setSummary(data);
      },

      phase2_progress: (data) => {
        // data: { status: "generating_configs" }
        setPhase((prev) => ({ ...prev, sub_phase: "generating_configs" }));
      },

      export_progress: (data) => {
        // data: { step: "exporting" | "validating" }
        setPhase((prev) => ({ ...prev, sub_phase: "validating" }));
      },

      complete: (data) => {
        setPhase({ phase: "success", sub_phase: null });
        setStatus("complete");
      },

      error: (data) => {
        setStatus("error");
        setPhase({ phase: "error", sub_phase: null });
      },

      keepalive: () => {
        // Just a heartbeat, nothing to do
      },
    };

    esRef.current = subscribeSSE(sessionId, handlers, () => {
      setStatus("error");
      setPhase({ phase: "error", sub_phase: null });
    });
  }, [reset]);

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStatus("idle");
    setPhase(null);
  }, []);

  return {
    thoughts,
    configTexts,
    topology,
    requirements,
    summary,
    phase,
    status,
    startStream,
    stopStream,
    reset,
  };
}
