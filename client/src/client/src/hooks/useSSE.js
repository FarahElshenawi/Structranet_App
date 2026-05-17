import { useState, useCallback, useRef } from "react";
import { subscribeSSE } from "../lib/api";

/**
 * Hook for SSE streaming from FastAPI.
 * Uses NAMED events from the backend:
 *   phase_change, thought, topology_ready, requirements_ready,
 *   summary_ready, phase2_progress, export_progress, complete, error, keepalive
 *
 * Returns { thoughts, topology, requirements, summary, status, startStream, reset }
 */
export default function useSSE() {
  const [thoughts, setThoughts] = useState([]);
  const [topology, setTopology] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | streaming | complete | error
  const esRef = useRef(null);

  const reset = useCallback(() => {
    setThoughts([]);
    setTopology(null);
    setRequirements(null);
    setSummary(null);
    setStatus("idle");
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
        // We use this for status tracking but don't expose it separately
        if (data.phase === "review" || data.phase === "success") {
          // Will be handled by complete/other events
        }
      },

      thought: (data) => {
        // data: { id, type, content, timestamp }
        setThoughts((prev) => [...prev, data]);
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
      },

      export_progress: (data) => {
        // data: { step: "exporting" | "validating" }
      },

      complete: (data) => {
        // data: { download_url, validator_passed, file_size_bytes, node_count, link_count, configured_count }
        setStatus("complete");
      },

      error: (data) => {
        // data: { message, phase }
        setStatus("error");
      },

      keepalive: () => {
        // Just a heartbeat, nothing to do
      },
    };

    esRef.current = subscribeSSE(sessionId, handlers, () => {
      setStatus("error");
    });
  }, [reset]);

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStatus("idle");
  }, []);

  return { thoughts, topology, requirements, summary, status, startStream, stopStream, reset };
}
