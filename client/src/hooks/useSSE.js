import { useState, useCallback, useRef } from "react";
import { subscribeSSE } from "../lib/api";

/**
 * Hook for SSE streaming from FastAPI.
 * Uses NAMED events from the backend:
 *   phase_change, thought, config_text, topology_ready, requirements_ready,
 *   summary_ready, phase2_progress, export_progress, complete, error, keepalive
 *
 * Returns { thoughts, configTexts, topology, requirements, summary, status,
 *           currentPhase, startStream, stopStream, reset }
 */
export default function useSSE() {
  const [thoughts, setThoughts] = useState([]);
  const [configTexts, setConfigTexts] = useState({}); // { deviceName: accumulatedText }
  const [topology, setTopology] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | streaming | complete | error
  const [currentPhase, setCurrentPhase] = useState(null); // "thinking" | "building" | "configuring" | "exporting"
  const esRef = useRef(null);

  const reset = useCallback(() => {
    setThoughts([]);
    setConfigTexts({});
    setTopology(null);
    setRequirements(null);
    setSummary(null);
    setStatus("idle");
    setCurrentPhase(null);
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
        if (data.sub_phase) {
          setCurrentPhase(data.sub_phase);
        } else if (data.phase === "generating") {
          setCurrentPhase("building");
        } else if (data.phase === "review") {
          setCurrentPhase("review");
        } else if (data.phase === "exporting") {
          setCurrentPhase("exporting");
        } else if (data.phase === "success") {
          setCurrentPhase(null);
        }
      },

      thought: (data) => {
        // data: { id, type, content, timestamp }
        setThoughts((prev) => [...prev, data]);
      },

      config_text: (data) => {
        // data: { device: "Core-Router", chunk: "...", is_start: bool }
        const device = data.device || "device";
        const chunk = data.chunk || "";
        const isStart = data.is_start || data.is_first;

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
        setCurrentPhase("configuring");
      },

      export_progress: (data) => {
        // data: { step: "exporting" | "validating" }
        setCurrentPhase("exporting");
      },

      complete: (data) => {
        // data: { download_url, validator_passed, file_size_bytes, node_count, link_count, configured_count }
        setStatus("complete");
        setCurrentPhase(null);
      },

      error: (data) => {
        // data: { message, phase }
        setStatus("error");
        setCurrentPhase(null);
      },

      keepalive: () => {
        // Just a heartbeat, nothing to do
      },
    };

    esRef.current = subscribeSSE(sessionId, handlers, () => {
      setStatus("error");
      setCurrentPhase(null);
    });
  }, [reset]);

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStatus("idle");
    setCurrentPhase(null);
  }, []);

  return {
    thoughts,
    configTexts,
    topology,
    requirements,
    summary,
    status,
    currentPhase,
    startStream,
    stopStream,
    reset,
  };
}
