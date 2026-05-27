const G = "#166534";
const BD = "#E5E7EB";

/**
 * SecurityClarification — Quick Reply chips for security scope selection.
 * Chips: Lab/None, Small Office/Basic, Corporate/Enterprise
 * Chips disappear once clicked (one-time shortcuts).
 */
export default function SecurityClarification({ onSelect }) {
  const profiles = [
    { id: "none", label: "Lab / None", emoji: "📄", desc: "No hardening — clean configs only" },
    { id: "basic", label: "Small Office / Basic", emoji: "🔒", desc: "SSH, AAA, NTP, Syslog" },
    { id: "enterprise", label: "Corporate / Enterprise", emoji: "🛡️", desc: "Full ZBF, ACLs, SNMPv3, HSRP" },
  ];

  return (
    <div style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16,
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            border: `1px solid #BBF7D0`,
            background: "#F0FDF4",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 500,
            color: G,
            cursor: "pointer",
            transition: "all .15s",
            fontFamily: "inherit",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = G;
            e.currentTarget.style.color = "white";
            e.currentTarget.style.borderColor = G;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#F0FDF4";
            e.currentTarget.style.color = G;
            e.currentTarget.style.borderColor = "#BBF7D0";
          }}
        >
          <span style={{ fontSize: 15 }}>{p.emoji}</span>
          {p.label}
        </button>
      ))}
    </div>
  );
}
