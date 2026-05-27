const G = "#166534";
const BD = "#E5E7EB";

/**
 * DigitalTwinConfirm — Quick Reply chips for baseline confirmation.
 * Chips: "Yes, this is my network" / "No, let me describe again"
 * Chips disappear once clicked.
 */
export default function DigitalTwinConfirm({ onConfirm, onDeny }) {
  return (
    <div style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16,
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      <button
        onClick={onConfirm}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 18px",
          border: "none",
          background: G,
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 600,
          color: "white",
          cursor: "pointer",
          transition: "all .15s",
          fontFamily: "inherit",
        }}
        onMouseOver={(e) => e.currentTarget.style.background = "#14532D"}
        onMouseOut={(e) => e.currentTarget.style.background = G}
      >
        ✅ Yes, this is my network
      </button>
      <button
        onClick={onDeny}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 18px",
          border: `1px solid ${BD}`,
          background: "white",
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 500,
          color: "#374151",
          cursor: "pointer",
          transition: "all .15s",
          fontFamily: "inherit",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = G;
          e.currentTarget.style.color = G;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = BD;
          e.currentTarget.style.color = "#374151";
        }}
      >
        ❌ No, let me describe again
      </button>
    </div>
  );
}
