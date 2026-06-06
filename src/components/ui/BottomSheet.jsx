// File: src/components/ui/BottomSheet.jsx

"use client";

import { useEffect, useState } from "react";

export default function BottomSheet({
  children,
  height = "18vh",
  padding = 12,
  collapsedHeight = "132px",
  expandedHeight = "56vh",
  defaultCollapsed = false,
  stateKey = "",
  title = "Ride details",
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed, stateKey]);

  const currentHeight = collapsed ? collapsedHeight : (expandedHeight || height);

  return (
    <section
      className={`nx-bottom-sheet ${collapsed ? "is-collapsed" : "is-expanded"}`}
      style={{ height: currentHeight, padding }}
    >
      <button
        type="button"
        className="nx-sheet-toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        <span className="nx-sheet-handle" />
        <span>{collapsed ? `Show ${title}` : "Hide details to see map"}</span>
      </button>
      <div className="nx-bottom-sheet-content">{children}</div>
    </section>
  );
}
