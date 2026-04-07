// File: src/components/ui/ActionCard.jsx

export default function ActionCard({ children, style = {} }) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(13,17,23,0.96), rgba(8,11,15,0.98))",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        padding: 14,
        boxShadow: "0 12px 28px rgba(0,0,0,0.20)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
