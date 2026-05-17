import { Icon, PATHS } from "./Icons";

const PRIMARY = "#166534";
const BORDER = "#E5E7EB";

const PHASE_LABELS = {
  generating: { label: "Generating Topology", icon: PATHS.sparkles, color: PRIMARY },
  thinking: { label: "AI Thinking", icon: PATHS.search, color: "#2563EB" },
  building: { label: "Building Topology", icon: PATHS.settings, color: "#7C3AED" },
  review: { label: "Review Ready", icon: PATHS.check, color: PRIMARY },
  exporting: { label: "Exporting", icon: PATHS.download, color: "#D97706" },
  generating_configs: { label: "Generating Device Configs", icon: PATHS.settings, color: "#7C3AED" },
  validating: { label: "Validating Project", icon: PATHS.shield, color: "#2563EB" },
  success: { label: "Complete", icon: PATHS.check, color: PRIMARY },
  error: { label: "Error", icon: PATHS.alert, color: "#DC2626" },
};

export default function GenerationProgress({ phase }) {
  if (!phase) return null;

  const { phase: currentPhase, sub_phase } = phase;
  const effectivePhase = sub_phase || currentPhase;
  const phaseInfo = PHASE_LABELS[effectivePhase] || PHASE_LABELS[currentPhase] || { label: currentPhase, icon: PATHS.settings, color: "#6B7280" };

  const isDone = currentPhase === "success" || currentPhase === "error";

  return (
    <div
      style={{
        fontFamily: "'Geist', system-ui, sans-serif",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        overflow: "hidden",
        background: "white",
      }}
    >
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${phaseInfo.color}10`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: isDone ? "none" : "pulse 2s infinite",
          }}
        >
          <Icon d={phaseInfo.icon} size={16} style={{ color: phaseInfo.color }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{phaseInfo.label}</div>
          <div style={{ fontSize: 11, color: "#6B7280" }}>
            {currentPhase === "generating" && sub_phase === "thinking" && "Analyzing your network requirements..."}
            {currentPhase === "generating" && sub_phase === "building" && "Constructing topology and assigning hardware..."}
            {currentPhase === "review" && "Topology is ready for your review"}
            {currentPhase === "exporting" && sub_phase === "generating_configs" && "Writing device startup configurations..."}
            {currentPhase === "exporting" && sub_phase === "validating" && "Validating GNS3 project integrity..."}
            {currentPhase === "exporting" && !sub_phase && "Preparing GNS3 project export..."}
            {currentPhase === "success" && "GNS3 project ready for download"}
            {currentPhase === "error" && "An error occurred during generation"}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: currentPhase === "success" ? PRIMARY : currentPhase === "error" ? "#DC2626" : "#D97706",
              animation: isDone ? "none" : "pulse 1.5s infinite",
            }}
          />
        </div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
