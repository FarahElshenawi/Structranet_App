import { useState } from "react";

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

const CHIPS = [
  { id: "edit", label: "Edit Topology", emoji: "✏️", variant: "outline" },
  { id: "approve", label: "Approve and Export", emoji: "✅", variant: "green" },
  { id: "ask", label: "Ask a Question", emoji: "🔍", variant: "ghost" },
];

/**
 * QuickReply — One-time shortcut chips that disappear when clicked.
 * Edit Topology (outline), Approve and Export (green), Ask a Question (ghost).
 */
export default function QuickReply({ onAction }) {
  const [clicked, setClicked] = useState(null);

  const handleClick = (id) => {
    setClicked(id);
    // Small delay to allow visual feedback before callback hides the chip
    setTimeout(() => onAction(id), 100);
  };

  return (
    <div style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16,
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {CHIPS.map((chip) => {
        if (clicked === chip.id) {
          // Chip fades out
          return (
            <span
              key={chip.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                opacity: 0.3,
                transition: "opacity .2s",
              }}
            >
              {chip.emoji} {chip.label}
            </span>
          );
        }

        const isGreen = chip.variant === "green";
        const isOutline = chip.variant === "outline";

        return (
          <button
            key={chip.id}
            onClick={() => handleClick(chip.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: `1px solid ${isGreen ? G : BD}`,
              background: isGreen ? G : "white",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
              color: isGreen ? "white" : "#374151",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .15s",
            }}
            onMouseOver={(e) => {
              if (isGreen) {
                e.currentTarget.style.background = "#14532D";
              } else {
                e.currentTarget.style.borderColor = G;
                e.currentTarget.style.color = G;
                e.currentTarget.style.background = "#F0FDF4";
              }
            }}
            onMouseOut={(e) => {
              if (isGreen) {
                e.currentTarget.style.background = G;
              } else {
                e.currentTarget.style.borderColor = BD;
                e.currentTarget.style.color = "#374151";
                e.currentTarget.style.background = "white";
              }
            }}
          >
            {chip.emoji} {chip.label}
          </button>
        );
      })}
    </div>
  );
}
