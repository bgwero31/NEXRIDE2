// File: src/components/ui/NexrideBrand.jsx

"use client";

import { useEffect, useState } from "react";

/**
 * NEXRIDE brand lockup — logo mark + wordmark + optional subtitle.
 * Falls back gracefully if the user's avatar fails to load.
 */
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
  const logoSrc = hasAvatar ? avatarUrl : "/nexride-logo.svg";

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
        <img
          src={logoSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
        />
      </div>
      <div className="nx-brand-copy">
        <div className="nx-brand-text">NEXRIDE</div>
        {subtitle ? <div className="nx-brand-subtitle">{subtitle}</div> : null}
      </div>
    </>
  );

  // Optional: render as a link (useful for header home link)
  if (asLink) {
    return (
      <a href={href} className={classes} aria-label="NEXRIDE home">
        {inner}
      </a>
    );
  }

  return <div className={classes}>{inner}</div>;
    }
