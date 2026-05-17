import { useState } from "react";
import { Icon, PATHS } from "./Icons";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";

export default function ProfileDrawer({ onClose, profile, onSave }) {
  const [version, setVersion] = useState(profile?.version || "");
  const [features, setFeatures] = useState(profile?.features || { iou: false, qemu: true, docker: false });
  const [images, setImages] = useState(profile?.images || ["c7200", "c3745"]);

  const quick = [
    "c7200", "c3745", "c3660",
    "i86bi_linux_l2-adventerprisek9-ms",
    "i86bi_linux_l3-adventerprisek9-ms",
    "csr1000v", "alpine", "vpcs",
    "ethernet_switch", "ethernet_hub",
  ];

  const handleSave = () => {
    onSave?.({ version, features, images });
    onClose?.();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.2)" }} />
      <div
        style={{
          width: 420,
          background: "white",
          height: "100vh",
          overflowY: "auto",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          fontFamily: "'Geist', system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#111" }}>Environment Profile</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
              Define your installed appliances and GNS3 version
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280", padding: 4 }}
          >
            <Icon d={PATHS.x} size={16} />
          </button>
        </div>

        {/* Warning */}
        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Icon d={PATHS.alert} size={16} style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
            No profile set — requirements manifest shown after generation
          </div>
        </div>

        {/* Version */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: 6,
            }}
          >
            GNS3 VERSION
          </label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g., 2.2.43"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              color: "#111",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Feature Support */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6B7280",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: 10,
            }}
          >
            FEATURE SUPPORT
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              ["iou", "IOU", PATHS.cpu],
              ["qemu", "QEMU", PATHS.server],
              ["docker", "Docker", PATHS.container],
            ].map(([key, label, iconPath]) => (
              <button
                key={key}
                onClick={() => setFeatures((f) => ({ ...f, [key]: !f[key] }))}
                style={{
                  padding: "14px 8px",
                  border: `1px solid ${features[key] ? PRIMARY : BORDER}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "center",
                  background: features[key] ? "rgba(22,101,52,0.05)" : "white",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  transition: "all .15s",
                }}
              >
                <Icon d={iconPath} size={20} style={{ color: features[key] ? PRIMARY : "#9CA3AF" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: features[key] ? PRIMARY : "#6B7280" }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Installed Images */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em" }}>
              INSTALLED IMAGES ({images.length})
            </label>
          </div>
          {images.length === 0 && (
            <div style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>No images added yet</div>
          )}
          {images.map((img, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                background: MUTED,
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "#374151" }}>{img}</span>
              <button
                onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", padding: 2 }}
              >
                <Icon d={PATHS.trash} size={13} />
              </button>
            </div>
          ))}

          {/* Quick Add */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6B7280",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              QUICK ADD
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {quick
                .filter((q) => !images.includes(q))
                .map((q) => (
                  <button
                    key={q}
                    onClick={() => setImages((i) => [...i, q])}
                    style={{
                      padding: "4px 10px",
                      border: `1px solid ${BORDER}`,
                      borderRadius: 20,
                      fontSize: 11,
                      fontFamily: "monospace",
                      background: "white",
                      cursor: "pointer",
                      color: "#374151",
                      transition: "all .15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(22,101,52,0.05)";
                      e.currentTarget.style.borderColor = PRIMARY;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = BORDER;
                    }}
                  >
                    + {q}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <button
          style={{
            background: PRIMARY,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: "auto",
            transition: "background .15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = PRIMARY_HOVER)}
          onMouseOut={(e) => (e.currentTarget.style.background = PRIMARY)}
          onClick={handleSave}
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}
