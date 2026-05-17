/**
 * NetworkLoader — animated network topology micro-icon.
 *
 * Pure HTML/CSS div-based animation (no SVG, no JS animation loop).
 * Shows 3 nodes (dots) connected by lines with traveling signal dots,
 * a center device rectangle that pulses, and expanding ring pulses on each node.
 *
 * Matches the approved mockup's .net-loader exactly.
 */
export default function NetworkLoader({ size = 28 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Faint link lines */}
      <div
        className="net-line net-line-1"
        style={{
          position: "absolute",
          background: "rgba(22,101,52,0.18)",
          height: 1.2,
          transformOrigin: "0% 50%",
          borderRadius: 1,
          width: 16,
          top: 6,
          left: 13,
          transform: "rotate(64deg)",
        }}
      />
      <div
        className="net-line net-line-2"
        style={{
          position: "absolute",
          background: "rgba(22,101,52,0.18)",
          height: 1.2,
          transformOrigin: "0% 50%",
          borderRadius: 1,
          width: 16,
          top: 6,
          left: 13,
          transform: "rotate(116deg)",
        }}
      />
      <div
        className="net-line net-line-3"
        style={{
          position: "absolute",
          background: "rgba(22,101,52,0.18)",
          height: 1.2,
          borderRadius: 1,
          width: 19,
          top: 20,
          left: 5,
        }}
      />

      {/* Signal dots traveling along lines */}
      <div
        className="net-signal-1"
        style={{
          position: "absolute",
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "#166534",
          boxShadow: "0 0 4px #166534",
        }}
      />
      <div
        className="net-signal-2"
        style={{
          position: "absolute",
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "#166534",
          boxShadow: "0 0 4px #166534",
        }}
      />
      <div
        className="net-signal-3"
        style={{
          position: "absolute",
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "#166534",
          boxShadow: "0 0 4px #166534",
        }}
      />

      {/* Node dots */}
      <div
        style={{
          position: "absolute",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "rgba(22,101,52,0.25)",
          border: "1px solid rgba(22,101,52,0.15)",
          top: 3,
          left: 11.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "rgba(22,101,52,0.25)",
          border: "1px solid rgba(22,101,52,0.15)",
          top: 19,
          left: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "rgba(22,101,52,0.25)",
          border: "1px solid rgba(22,101,52,0.15)",
          top: 19,
          left: 21,
        }}
      />

      {/* Ring pulses */}
      <div className="net-ring-1" />
      <div className="net-ring-2" />
      <div className="net-ring-3" />

      {/* Center device */}
      <div
        style={{
          position: "absolute",
          top: 11,
          left: 10,
          width: 8,
          height: 5,
          borderRadius: 1.5,
          background: "rgba(22,101,52,0.3)",
          border: "0.8px solid rgba(22,101,52,0.15)",
        }}
      />
      <div className="net-device-glow" />

      {/* Keyframe styles */}
      <style>{`
        .net-ring-1, .net-ring-2, .net-ring-3 {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          border: 1.2px solid #166534;
          opacity: 0;
        }
        .net-ring-1 { top: 3px; left: 11.5px; animation: netRing 2.4s ease infinite 0s; }
        .net-ring-2 { top: 19px; left: 2px; animation: netRing 2.4s ease infinite 0.8s; }
        .net-ring-3 { top: 19px; left: 21px; animation: netRing 2.4s ease infinite 1.6s; }

        .net-device-glow {
          position: absolute; top: 11px; left: 10px; width: 8px; height: 5px;
          border-radius: 1.5px; background: #166534; opacity: 0;
          animation: netGlow 2.4s ease infinite 0.4s;
        }

        @keyframes netRing {
          0% { opacity: 0; transform: scale(1); }
          15% { opacity: 0.8; }
          40% { opacity: 0; transform: scale(2.8); }
          100% { opacity: 0; transform: scale(2.8); }
        }
        @keyframes netGlow {
          0% { opacity: 0; }
          15% { opacity: 0.9; }
          35% { opacity: 0.7; }
          55% { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes netSig1 {
          0% { top: 6px; left: 13px; opacity: 0; }
          10% { opacity: 1; }
          40% { top: 19px; left: 3px; opacity: 1; }
          50% { opacity: 0; }
          100% { top: 19px; left: 3px; opacity: 0; }
        }
        @keyframes netSig2 {
          0% { top: 6px; left: 13px; opacity: 0; }
          10% { opacity: 1; }
          40% { top: 19px; left: 22px; opacity: 1; }
          50% { opacity: 0; }
          100% { top: 19px; left: 22px; opacity: 0; }
        }
        @keyframes netSig3 {
          0% { top: 20px; left: 4px; opacity: 0; }
          10% { opacity: 1; }
          40% { top: 20px; left: 21px; opacity: 1; }
          50% { opacity: 0; }
          100% { top: 20px; left: 21px; opacity: 0; }
        }

        .net-signal-1 { animation: netSig1 2.4s linear infinite; }
        .net-signal-2 { animation: netSig2 2.4s linear infinite 0.8s; }
        .net-signal-3 { animation: netSig3 2.4s linear infinite 1.6s; }
      `}</style>
    </div>
  );
}
