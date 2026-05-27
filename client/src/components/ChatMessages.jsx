import SecurityClarification from "./SecurityClarification";
import TopologyReviewCard from "./TopologyReviewCard";
import DigitalTwinConfirm from "./DigitalTwinConfirm";
import GenerationProgress from "./GenerationProgress";
import ConfigStream from "./ConfigStream";
import DownloadCards from "./DownloadCards";
import QuickReply from "./QuickReply";
import RequirementsPanel from "./RequirementsPanel";
import SummaryPanel from "./SummaryPanel";
import ThoughtStream from "./ThoughtStream";
import NetworkLoader from "./NetworkLoader";

const G = "#166534";

function NetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="4" rx="1"/>
      <rect x="9" y="18" width="6" height="4" rx="1"/>
      <rect x="2" y="10" width="6" height="4" rx="1"/>
      <rect x="16" y="10" width="6" height="4" rx="1"/>
      <line x1="12" y1="6" x2="12" y2="10"/>
      <line x1="12" y1="14" x2="12" y2="18"/>
      <line x1="8" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="16" y2="12"/>
    </svg>
  );
}

function Ic({ d, size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || "currentColor"} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const IC = {
  check:  "M20 6L9 17l-5-5",
  alert:  "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
};

function Cursor() {
  return (
    <>
      <span style={{
        display: "inline-block", width: 7, height: 14,
        background: G, marginLeft: 2,
        verticalAlign: "text-bottom",
        animation: "cmBlink 1s step-end infinite",
      }}/>
      <style>{`@keyframes cmBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </>
  );
}

function AIAvatar({ animate }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: animate ? G : "#E5E7EB",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: animate ? "white" : "#9CA3AF",
      flexShrink: 0,
      transition: "background .3s",
      boxShadow: animate ? "0 0 0 3px rgba(22,101,52,0.15)" : "none",
    }}>
      <NetIcon size={14}/>
    </div>
  );
}

function PulseRing() {
  return (
    <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "rgba(22,101,52,0.15)",
        animation: "cmRing 1.5s ease-out infinite",
      }}/>
      <div style={{
        position: "absolute", inset: 4, borderRadius: "50%",
        background: G,
      }}/>
      <style>{`@keyframes cmRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}`}</style>
    </div>
  );
}

/**
 * ChatMessages — Renders all chat states inline in one scroll.
 * One continuous scroll for the entire chat conversation — NO page breaks between states.
 */
export default function ChatMessages({
  messages,
  chatState,
  thoughts,
  topology,
  requirements,
  summary,
  configTexts,
  streamingJsonText,
  agentMessage,
  securityProfile,
  isBaseline,
  isActive,
  onOpenTopology,
  onSecuritySelect,
  onQuickReply,
  onBaselineConfirm,
  onBaselineDeny,
  sessionId,
  projectName,
  onDownload,
  exportData,
}) {
  const deviceNames = Object.keys(configTexts || {});
  const isStreaming = chatState === "generating" || chatState === "config-streaming";
  const isConfigPhase = chatState === "config-streaming";

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "20px 24px",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 16,
              }}>
                <div style={{
                  background: G,
                  color: "white",
                  padding: "10px 16px",
                  borderRadius: "12px 12px 4px 12px",
                  fontSize: 14,
                  lineHeight: 1.6,
                  maxWidth: "80%",
                  wordBreak: "break-word",
                }}>
                  {msg.content}
                </div>
              </div>
            );
          }

          // Assistant message
          return (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-start" }}>
              <AIAvatar animate={isActive && isStreaming && i === messages.length - 1}/>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Typing indicator for active streaming */}
                {isActive && isStreaming && i === messages.length - 1 && !agentMessage && thoughts.length === 0 && !topology && deviceNames.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <PulseRing/>
                    <span style={{ fontSize: 13, color: "#6B7280", animation: "cmFade 1.5s ease-in-out infinite" }}>
                      AI is thinking...
                    </span>
                    <style>{`@keyframes cmFade{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
                  </div>
                )}

                {/* Agent message text */}
                {agentMessage && i === messages.length - 1 && (
                  <div style={{
                    fontSize: 14, color: "#374151", lineHeight: 1.7,
                    marginBottom: 16, whiteSpace: "pre-wrap",
                  }}>
                    {agentMessage}
                    {isActive && isStreaming && <Cursor/>}
                  </div>
                )}

                {/* Thoughts */}
                {thoughts.length > 0 && i === messages.length - 1 && (
                  <ThoughtStream thoughts={thoughts} isStreaming={isActive && isStreaming}/>
                )}

                {/* Security clarification */}
                {chatState === "security-clarification" && i === messages.length - 1 && (
                  <SecurityClarification onSelect={onSecuritySelect}/>
                )}

                {/* Generating state: NetworkLoader + JSON stream card */}
                {chatState === "generating" && i === messages.length - 1 && (
                  <GenerationProgress
                    title={isBaseline ? "Reconstructing Current Network" : "Generating Topology"}
                    streamingText={streamingJsonText}
                    isStreaming={isActive}
                  />
                )}

                {/* Review state: Topology card + QuickReply + Requirements + Summary */}
                {chatState === "review" && topology && i === messages.length - 1 && (
                  <>
                    <TopologyReviewCard
                      topology={topology}
                      requirements={requirements}
                      summary={summary}
                      securityProfile={securityProfile}
                      isBaseline={false}
                      onExpand={onOpenTopology}
                    />
                    <QuickReply onAction={onQuickReply}/>
                    <RequirementsPanel requirements={requirements}/>
                    <SummaryPanel summary={summary}/>
                  </>
                )}

                {/* Digital twin confirm state */}
                {chatState === "digital-twin-confirm" && topology && i === messages.length - 1 && (
                  <>
                    <TopologyReviewCard
                      topology={topology}
                      requirements={requirements}
                      securityProfile={securityProfile}
                      isBaseline={true}
                      onExpand={onOpenTopology}
                    />
                    <DigitalTwinConfirm
                      onConfirm={onBaselineConfirm}
                      onDeny={onBaselineDeny}
                    />
                  </>
                )}

                {/* Config streaming state */}
                {chatState === "config-streaming" && i === messages.length - 1 && (
                  <>
                    {/* System message */}
                    <div style={{
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: G,
                      fontWeight: 500,
                    }}>
                      ✅ Looks good! Generating device configurations...
                    </div>
                    <ConfigStream
                      configTexts={configTexts}
                      isStreaming={isActive}
                      activeDevice={deviceNames[deviceNames.length - 1]}
                    />
                  </>
                )}

                {/* Complete state: Download cards */}
                {chatState === "complete" && i === messages.length - 1 && (
                  <>
                    {/* System messages */}
                    <div style={{
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: G,
                      fontWeight: 500,
                    }}>
                      ✅ Looks good! Generating device configurations...
                    </div>
                    <DownloadCards
                      projectName={projectName}
                      sessionId={sessionId}
                      onDownload={onDownload}
                    />
                  </>
                )}

                {/* Error */}
                {chatState === "error" && i === messages.length - 1 && (
                  <div style={{
                    background: "#FEF2F2", border: "1px solid #FECACA",
                    borderRadius: 10, padding: "12px 14px",
                    fontSize: 13, color: "#DC2626",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <Ic d={IC.alert} size={14} color="#DC2626"/>
                    Generation failed. Please try again or edit your prompt.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
