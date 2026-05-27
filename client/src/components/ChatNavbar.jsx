import { NetworkIcon } from "./Icons";

const G = "#166534";
const BD = "#E5E7EB";

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
  menu:     "M3 12h18M3 6h18M3 18h18",
  expand:   "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  settings: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export default function ChatNavbar({
  onToggleSidebar,
  onViewTopology,
  onOpenProfile,
  onLogout,
  showViewTopology,
}) {
  return (
    <div style={{
      height: 52,
      background: "white",
      borderBottom: `1px solid ${BD}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      flexShrink: 0,
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onToggleSidebar} style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: "#6B7280", padding: 4, display: "flex",
        }}
          onMouseOver={(e) => e.currentTarget.style.color = "#111"}
          onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
        >
          <Ic d={IC.menu} size={20}/>
        </button>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: G,
          display: "flex", alignItems: "center", justifyContent: "center", color: "white",
        }}>
          <NetworkIcon size={14}/>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>StructuraNet AI</span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* View Topology button — only during review state */}
        {showViewTopology && (
          <button
            onClick={onViewTopology}
            style={{
              border: `1px solid #BBF7D0`,
              background: "#F0FDF4",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: G,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "inherit",
              transition: "all .15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = G;
              e.currentTarget.style.color = "white";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#F0FDF4";
              e.currentTarget.style.color = G;
            }}
          >
            <Ic d={IC.expand} size={13}/> View Topology
          </button>
        )}

        <button onClick={onOpenProfile} style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: "#6B7280", padding: 6, display: "flex", borderRadius: 6,
        }}
          onMouseOver={(e) => e.currentTarget.style.background = "#F3F4F6"}
          onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
        >
          <Ic d={IC.settings} size={18}/>
        </button>

        <button onClick={onLogout} style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: "#6B7280", padding: 6, display: "flex", borderRadius: 6,
        }}
          onMouseOver={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#EF4444"; }}
          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
        >
          <Ic d={IC.logout} size={18}/>
        </button>
      </div>
    </div>
  );
}
