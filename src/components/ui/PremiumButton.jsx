// File: src/components/ui/PremiumButton.jsx
/**
 * Primary NEXRIDE button. Supports variants, loading state, and passthrough props.
 *
 * Variants: "primary" | "secondary" | "ghost" | "danger"
 */

const VARIANT_CLASS = {
  primary: "nx-btn-primary",
  secondary: "nx-btn-secondary",
  ghost: "nx-btn-ghost",
  danger: "nx-btn-danger",
};

export default function PremiumButton({
  children,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  variant = "primary",
  className = "",
  style,
  ...rest
}) {
  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const isDisabled = disabled || loading;

  const classes = [
    "nx-btn",
    variantClass,
    fullWidth ? "nx-btn-block" : "",
    loading ? "nx-btn-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      style={style}
      {...rest}
    >
      {loading ? (
        <>
          <span className="nx-btn-spinner" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
