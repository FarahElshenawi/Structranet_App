import { useState, useEffect, useRef } from "react";
import { getUserProfile, updateUserProfile } from "../lib/api";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";

// ── Appliance catalog for search ──
const APPLIANCE_CATALOG = [
  { name: "c7200", type: "Dynamips" },
  { name: "c3745", type: "Dynamips" },
  { name: "c3660", type: "Dynamips" },
  { name: "c3600", type: "Dynamips" },
  { name: "c2600", type: "Dynamips" },
  { name: "c1700", type: "Dynamips" },
  { name: "i86bi_linux_l2-adventerprisek9-ms", type: "IOU" },
  { name: "i86bi_linux_l3-adventerprisek9-ms", type: "IOU" },
  { name: "i86bi_linux_l2-ipbasek9-ms", type: "IOU" },
  { name: "csr1000v", type: "QEMU" },
  { name: "nxosv9k", type: "QEMU" },
  { name: "asav", type: "QEMU" },
  { name: "vios", type: "QEMU" },
  { name: "vIOS-L2", type: "QEMU" },
  { name: "vpcs", type: "VPCS" },
  { name: "alpine", type: "Docker" },
  { name: "ubuntu", type: "Docker" },
  { name: "ovs", type: "Docker" },
  { name: "ethernet_switch", type: "Built-in" },
  { name: "ethernet_hub", type: "Built-in" },
  { name: "Nat", type: "Built-in" },
  { name: "cloud", type: "Built-in" },
];

export default function ProfileModal({ onClose, onSaved }) {
  const [version, setVersion] = useState("");
  const [features, setFeatures] = useState({ iou: false, qemu: true, docker: false });
  const [images, setImages] = useState([]); // [{ name, filename }]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  const [filename, setFilename] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  // ── Load profile on mount ──
  useEffect(() => {
    let cancelled = false;
    getUserProfile()
      .then((data) => {
        if (cancelled) return;
        const p = data.profile || {};
        setVersion(p.version || "");
        setFeatures(
          p.features && typeof p.features === "object" ? p.features : { iou: false, qemu: true, docker: false }
        );
        setImages(Array.isArray(p.images) ? p.images : []);
      })
      .catch(() => {
        // Profile not set yet — keep defaults
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Filtered catalog for search ──
  const safeImages = Array.isArray(images) ? images : [];
  const filteredCatalog = APPLIANCE_CATALOG.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !safeImages.some((img) => img.name === a.name)
  );

  // ── Highlight matching text ──
  const highlightMatch = (text, query) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ color: PRIMARY, fontWeight: 600 }}>
          {text.slice(idx, idx + query.length)}
        </span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // ── Add image ──
  const handleAddImage = () => {
    if (!selectedAppliance) return;
    setImages((prev) => [
      ...prev,
      { name: selectedAppliance.name, filename: filename.trim() },
    ]);
    setSelectedAppliance(null);
    setFilename("");
    setSearchQuery("");
    setShowDropdown(false);
  };

  // ── Remove image ──
  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save profile ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ version, features, images });
      onSaved?.({ version, features, images });
      onClose?.();
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Feature icon paths ──
  const featureIcons = {
    iou: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 0 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 0-2-2V9m0 0h18",
    qemu: "M2 3h20v14H2zM8 21h8M12 17v4",
    docker:
      "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  };

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            width: 480,
            background: "white",
            borderRadius: 16,
            boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
            padding: "40px 24px",
            textAlign: "center",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          <div style={{ color: "#9CA3AF", fontSize: 14 }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          width: 480,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
          overflow: "hidden",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>
              Set Up Your GNS3 Environment
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginTop: 3,
                margin: 0,
                paddingTop: 3,
              }}
            >
              Configure your installed appliances for accurate topology matching
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6B7280",
              padding: 4,
              display: "flex",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          {/* Info Box */}
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
            <div style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
              </svg>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "#92400E",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Specifying your installed images helps us generate topologies that
              match your actual GNS3 environment.
            </p>
          </div>

          {/* GNS3 Version */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6B7280",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: 8,
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
                color: "#111",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
              onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
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
                marginBottom: 8,
              }}
            >
              FEATURE SUPPORT
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              {[
                { key: "iou", label: "IOU" },
                { key: "qemu", label: "QEMU" },
                { key: "docker", label: "Docker" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() =>
                    setFeatures((f) => ({ ...f, [key]: !f[key] }))
                  }
                  style={{
                    padding: "14px 8px",
                    border: `1px solid ${features[key] ? PRIMARY : BORDER}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "center",
                    background: features[key]
                      ? "rgba(22,101,52,0.05)"
                      : "white",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    transition: "all .15s",
                    fontFamily: "inherit",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={features[key] ? PRIMARY : "#9CA3AF"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={featureIcons[key]} />
                  </svg>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: features[key] ? PRIMARY : "#6B7280",
                    }}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Installed Images */}
          {safeImages.length > 0 && (
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6B7280",
                  letterSpacing: "0.05em",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                INSTALLED IMAGES ({safeImages.length})
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {safeImages.map((img, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      background: MUTED,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "#374151",
                        }}
                      >
                        {img.name}
                      </div>
                      {img.filename && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            fontFamily: "monospace",
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {img.filename}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveImage(i)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "#9CA3AF",
                        padding: 2,
                        display: "flex",
                        flexShrink: 0,
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.color = "#EF4444")}
                      onMouseOut={(e) => (e.currentTarget.style.color = "#9CA3AF")}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Image — Search + Dropdown */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6B7280",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: 8,
              }}
            >
              ADD IMAGE
            </label>
            <div style={{ position: "relative" }}>
              {/* Search icon */}
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: 10,
                  color: "#9CA3AF",
                  pointerEvents: "none",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search appliance name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  setSelectedAppliance(null);
                }}
                onFocus={() => setShowDropdown(true)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  fontSize: 14,
                  color: "#111",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                onFocusCapture={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                onBlur={(e) => {
                  // Don't reset if clicking dropdown
                  setTimeout(() => e.currentTarget.style.borderColor = BORDER, 150);
                }}
              />
              {/* Dropdown */}
              {showDropdown && filteredCatalog.length > 0 && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    maxHeight: 180,
                    overflowY: "auto",
                    zIndex: 10,
                  }}
                >
                  {filteredCatalog.map((appliance) => (
                    <div
                      key={appliance.name}
                      onClick={() => {
                        setSelectedAppliance(appliance);
                        setSearchQuery(appliance.name);
                        setShowDropdown(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontFamily: "monospace",
                        color: "#374151",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span>{highlightMatch(appliance.name, searchQuery)}</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#9CA3AF",
                          fontFamily: "'Inter', sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {appliance.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filename row — appears after selecting an appliance */}
            {selectedAppliance && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  type="text"
                  placeholder="Your actual image filename..."
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#111",
                    outline: "none",
                    fontFamily: "monospace",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                />
                <button
                  onClick={handleAddImage}
                  style={{
                    padding: "10px 16px",
                    border: "none",
                    background: PRIMARY,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "white",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "inherit",
                    transition: "background .15s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = PRIMARY_HOVER)}
                  onMouseOut={(e) => (e.currentTarget.style.background = PRIMARY)}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${BORDER}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "9px 18px",
              border: `1px solid ${BORDER}`,
              background: "white",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: "#6B7280",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background .15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseOut={(e) => (e.currentTarget.style.background = "white")}
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 20px",
              border: "none",
              background: saving ? "#9CA3AF" : PRIMARY,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "white",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background .15s",
            }}
            onMouseOver={(e) => {
              if (!saving) e.currentTarget.style.background = PRIMARY_HOVER;
            }}
            onMouseOut={(e) => {
              if (!saving) e.currentTarget.style.background = PRIMARY;
            }}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
