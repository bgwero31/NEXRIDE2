// File: src/components/ui/NexrideBrand.jsx

export default function NexrideBrand({ size = "normal", subtitle = "" }) {
  const compact = size === "small";

  return (
    <div className={`nx-brand ${compact ? "nx-brand-small" : ""}`}>
      <div className="nx-brand-mark" aria-hidden="true">
        <span />
      </div>
      <div className="nx-brand-copy">
        <div className="nx-brand-text">NEXRIDE</div>
        {subtitle ? <div className="nx-brand-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}
