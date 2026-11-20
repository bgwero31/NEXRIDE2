// File: src/components/ui/NexrideBrand.jsx

"use client";

import { useEffect, useState } from "react";

export default function NexrideBrand({
  size = "normal",
  subtitle = "",
  avatarUrl = "",
  className = "",
  asLink = false,
  href = "/",
}) {
  const compact = size === "small";
  const [imageError, setImageError] = useState(false);

  // Reset error state if avatar URL changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const hasAvatar = Boolean(avatarUrl) && !imageError;
  // USE YOUR ACTUAL LOGO FILE HERE
  const logoSrc = hasAvatar ? avatarUrl : "/nexridebackground10.jpg"; 

  const classes = [
    "nx-brand",
    compact ? "nx-brand-small" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <div
        className={`nx-brand-mark ${hasAvatar ? "has-photo" : ""}`}
        aria-hidden="true"
      >
        {imageError ? (
          <span style={{ fontWeight: 1000, fontSize: "24px", color: "#fff" }}>N</span>
        ) : (
          <img
            src={logoSrc}
            alt="NEXRIDE"
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        )}
      </div>
      <div className="nx-brand-copy">
        <div className="nx-brand-text">NEXRIDE</div>
        {subtitle ? <div className="nx-brand-subtitle">{subtitle}</div> : null}
      </div>
    </>
  );

  if (asLink) {
    return (
      <a href={href} className={classes} aria-label="NEXRIDE home">
        {inner}
      </a>
    );
  }

  return <div className={classes}>{inner}</div>;
}
