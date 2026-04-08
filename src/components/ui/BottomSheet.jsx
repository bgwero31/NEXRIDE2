// File: src/components/ui/BottomSheet.jsx

export default function BottomSheet({
  children,
  height = "34vh",
  padding = 14,
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
        maxHeight: "74vh",
        overflowY: "auto",
        background:
          "linear-gradient(180deg, rgba(6,14,28,0.74), rgba(4,10,22,0.88))",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 60px rgba(0,0,0,0.32)",
        backdropFilter: "blur(20px)",
        padding,
      }}
    >
      <div
        style={{
          width: 52,
          height: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,0.16)",
          margin: "0 auto 12px",
        }}
      />
      {children}
    </div>
  );
}
