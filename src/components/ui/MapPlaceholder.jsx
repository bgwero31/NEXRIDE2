// File: src/components/ui/MapPlaceholder.jsx

export default function MapPlaceholder({
  label = "Map loading",
  sublabel = "Live rides and routes will appear here",
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 30% 20%, rgba(0,198,255,0.13), transparent 20%), radial-gradient(circle at 70% 40%, rgba(0,102,255,0.14), transparent 24%), linear-gradient(180deg, #07111e 0%, #04080f 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.14,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          transform: "translate(-50%, -50%)",
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: "rgba(0,198,255,0.08)",
          filter: "blur(4px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "44%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "#00c6ff",
            margin: "0 auto 12px",
            boxShadow: "0 0 20px rgba(0,198,255,0.7)",
          }}
        />
        <div style={{ fontWeight: 900, fontSize: 16 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#9fb3c8", marginTop: 5 }}>
          {sublabel}
        </div>
      </div>
    </div>
  );
}
