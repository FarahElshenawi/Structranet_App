import { useState, useCallback, useRef } from "react";
import { subscribeSSE } from "../lib/api";

/**
 * Hook for SSE streaming from FastAPI.
 * Returns { thoughts, topology, requirements, status, startStream, reset }
 */
export default function useSSE() {
  const [thoughts, setThoughts] = useState([]);
  const [topology, setTopology] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | streaming | complete | error
  const esRef = useRef(null);

  const reset = useCallback(() => {
    setThoughts([]);
    setTopology(null);
    setRequirements(null);
    setStatus("idle");
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const startStream = useCallback((sessionId) => {
    reset();
    setStatus("streaming");

    esRef.current = subscribeSSE(
      sessionId,
      (data) => {
        switch (data.type) {
          case "thought":
            setThoughts((prev) => [...prev, data]);
            break;
          case "topology":
            setTopology(data.topology);
            break;
          case "requirements":
            setRequirements(data.requirements);
            break;
          case "complete":
            setStatus("complete");
            break;
          case "error":
            setStatus("error");
            break;
          default:
            break;
        }
      },
      () => {
        setStatus("error");
      }
    );
  }, [reset]);

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStatus("idle");
  }, []);

  return { thoughts, topology, requirements, status, startStream, stopStream, reset };
}
