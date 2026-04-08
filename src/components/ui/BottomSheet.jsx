// File: src/components/ui/BottomSheet.jsx

export default function BottomSheet({
  children,
  height = "28vh",
  padding = 12,
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        bottom: 10,
        zIndex: 20,
        minHeight: height,
        maxHeight: "58vh",
        overflowY: "auto",
        background:
          "linear-gradient(180deg, rgba(7,18,38,0.68), rgba(4,10,22,0.86))",
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
        backdropFilter: "blur(18px)",
        padding,
      }}
    >
      <div
        style={{
          width: 48,
          height: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,0.16)",
          margin: "0 auto 10px",
        }}
      />
      {children}
    </div>
  );
}
