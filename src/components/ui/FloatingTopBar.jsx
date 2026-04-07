// File: src/components/ui/FloatingTopBar.jsx

export default function FloatingTopBar({
  title = "NEXRIDE",
  subtitle = "",
  right = null,
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: 14,
        right: 14,
        zIndex: 30,
        background: "rgba(8, 14, 24, 0.72)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(14px)",
        borderRadius: 22,
        padding: "14px 16px",
        boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 1000,
              letterSpacing: 0.4,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#9fb3c8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {right}
      </div>
    </div>
  );
                }
