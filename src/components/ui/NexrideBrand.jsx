// File: src/components/ui/NexrideBrand.jsx

export default function NexrideBrand({ size = "normal", subtitle = "", avatarUrl = "" }) {
  const compact = size === "small";
  const hasAvatar = Boolean(avatarUrl);

  return (
    <div className={`nx-brand ${compact ? "nx-brand-small" : ""}`}>
      <div className={`nx-brand-mark ${hasAvatar ? "has-photo" : ""}`} aria-hidden="true">
        <img src={hasAvatar ? avatarUrl : "/nexride-logo.svg"} alt="" />
      </div>
      <div className="nx-brand-copy">
        <div className="nx-brand-text">NEXRIDE</div>
        {subtitle ? <div className="nx-brand-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}
