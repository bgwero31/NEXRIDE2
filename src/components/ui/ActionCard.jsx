// File: src/components/ui/ActionCard.jsx

export default function ActionCard({ children, style = {}, className = "" }) {
  return (
    <div className={`nx-glass-panel nx-card-pro ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
