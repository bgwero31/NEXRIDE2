export default function BottomSheet({
  children,
  height = "48vh",
  padding = 14,
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        minHeight: height,
        maxHeight: "72vh",
        overflowY: "auto",
        background:
          "linear-gradient(180deg, rgba(6,10,16,0.96), rgba(3,6,10,0.99))",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 -18px 50px rgba(0,0,0,0.45)",
        padding,
      }}
    >
      <div
        style={{
          width: 52,
          height: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,0.14)",
          margin: "0 auto 12px",
        }}
      />
      {children}
    </div>
  );
}
