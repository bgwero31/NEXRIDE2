// File: src/components/ui/ActionCard.jsx
/**
 * Glass-morphism card container used across NEXRIDE.
 * Passthrough to any extra props (id, onClick, aria-*, data-*).
 */
export default function ActionCard({ children, className = "", style, ...rest }) {
  const classes = `nx-glass-panel nx-card-pro ${className}`.trim();
  return (
    <div className={classes} style={style} {...rest}>
      {children}
    </div>
  );
}
