import "./phaseProgress.css";

/**
 * PhaseProgress — Shows the current pipeline phase with animated indicators.
 *
 * Props:
 *   phase: "idle" | "generating" | "review" | "exporting" | "success" | "error"
 *   subPhase: "thinking" | "building" | "finalizing" | null
 *   thoughts: [{id, type, content}] — streamed AI thinking chunks
 *   error: string | null
 */
const PHASES = [
  { key: "generating", label: "Generating", icon: "🧠" },
  { key: "review", label: "Review", icon: "🔍" },
  { key: "exporting", label: "Exporting", icon: "📦" },
  { key: "success", label: "Complete", icon: "✅" },
];

const PHASE_ORDER = ["idle", "generating", "review", "exporting", "success", "error"];

const SUB_PHASE_LABELS = {
  thinking: "AI is analyzing your request...",
  building: "Building topology structure...",
  finalizing: "Finalizing GNS3 project...",
};

const PhaseProgress = ({ phase = "idle", subPhase = null, thoughts = [], error = null }) => {
  if (phase === "idle") return null;

  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="sn-phase-progress">
      {/* Phase steps bar */}
      <div className="sn-phase-steps">
        {PHASES.map((p, i) => {
          const pIdx = PHASE_ORDER.indexOf(p.key);
          const isActive = p.key === phase;
          const isDone = currentIdx > pIdx;
          const isUpcoming = currentIdx < pIdx;

          return (
            <div
              key={p.key}
              className={`sn-phase-step ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${isUpcoming ? "upcoming" : ""}`}
            >
              <div className="sn-phase-dot">
                {isDone ? "✓" : p.icon}
              </div>
              <span className="sn-phase-label">{p.label}</span>
            </div>
          );
        })}
      </div>

      {/* Sub-phase indicator */}
      {subPhase && SUB_PHASE_LABELS[subPhase] && (
        <div className="sn-subphase">
          <div className="sn-subphase-spinner" />
          <span>{SUB_PHASE_LABELS[subPhase]}</span>
        </div>
      )}

      {/* Streaming thoughts */}
      {thoughts.length > 0 && (
        <div className="sn-thoughts-stream">
          {thoughts.map((t) => (
            <div key={t.id} className={`sn-thought sn-thought-${t.type}`}>
              <span className="sn-thought-badge">{t.type}</span>
              <span className="sn-thought-text">{t.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="sn-phase-error">
          <span className="sn-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default PhaseProgress;
