// File: src/components/ui/PremiumButton.jsx

export default function PremiumButton({
  children,
  type = "button",
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  style = {},
}) {
  const cls = variant === "ghost" ? "nx-btn-ghost" : variant === "secondary" ? "nx-btn-secondary" : "nx-btn-primary";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`nx-btn ${cls} ${className}`.trim()}
      style={style}
    >
      {children}
    </button>
  );
}
