// File: src/components/ui/BottomSheet.jsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ Constants ----------------------------- */

const SWIPE_CLOSE_PX = 60;   // drag down ≥ 60px → collapse
const SWIPE_OPEN_PX = -40;   // drag up ≥ 40px → expand
const SWIPE_VELOCITY = 0.5;  // px/ms — fast flick overrides distance

/* ---------------------------- Component ------------------------------- */

export default function BottomSheet({
  children,
  height = "18vh",
  padding = 12,
  collapsedHeight = "132px",
  expandedHeight = "56vh",
  defaultCollapsed = false,
  stateKey = "",
  title = "Ride details",
  onCollapsedChange, // optional
  headerExtra = null, // optional — slot to the right of the toggle
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const sheetRef = useRef(null);

  // Gesture tracking
  const dragRef = useRef({
    active: false,
    startY: 0,
    startTime: 0,
    moved: 0,
  });

  /* -------- Reset on stateKey change ONLY (not on every prop) ------- */
  const lastStateKeyRef = useRef(stateKey);
  useEffect(() => {
    if (stateKey !== lastStateKeyRef.current) {
      lastStateKeyRef.current = stateKey;
      setCollapsed(defaultCollapsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  // Expose collapse state to parent
  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  /* ------------------------ Toggle handlers ------------------------- */
  const setSheetCollapsed = useCallback((next) => {
    setCollapsed(next);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  /* ------------------------ Swipe gestures -------------------------- */
  const onPointerDown = useCallback((e) => {
    // Only left button / touch / pen
    if (e.button !== undefined && e.button !== 0) return;
    dragRef.current = {
      active: true,
      startY: e.clientY,
      startTime: performance.now(),
      moved: 0,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const delta = e.clientY - dragRef.current.startY;
    dragRef.current.moved = delta;

    // Live feedback: slight translate while dragging
    if (sheetRef.current && delta > 0 && !collapsed) {
      sheetRef.current.style.transform = `translateY(${Math.min(delta * 0.4, 24)}px)`;
    } else if (sheetRef.current && delta < 0 && collapsed) {
      sheetRef.current.style.transform = `translateY(${Math.max(delta * 0.4, -16)}px)`;
    }
  }, [collapsed]);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current.active) return;
    const delta = dragRef.current.moved;
    const elapsed = performance.now() - dragRef.current.startTime;
    const velocity = delta / Math.max(elapsed, 1);
    dragRef.current.active = false;

    // Reset any live transform
    if (sheetRef.current) sheetRef.current.style.transform = "";

    // Decide: flick OR drag threshold
    const flickDown = velocity > SWIPE_VELOCITY && delta > 20;
    const flickUp = velocity < -SWIPE_VELOCITY && delta < -20;

    if (!collapsed && (delta > SWIPE_CLOSE_PX || flickDown)) {
      setSheetCollapsed(true);
    } else if (collapsed && (delta < SWIPE_OPEN_PX || flickUp)) {
      setSheetCollapsed(false);
    }
  }, [collapsed, setSheetCollapsed]);

  const onPointerCancel = useCallback(() => {
    dragRef.current.active = false;
    if (sheetRef.current) sheetRef.current.style.transform = "";
  }, []);

  /* -------------------------- Derived ----------------------------- */
  const currentHeight = useMemo(
    () => (collapsed ? collapsedHeight : expandedHeight || height),
    [collapsed, collapsedHeight, expandedHeight, height]
  );

  const toggleLabel = collapsed ? `Show ${title}` : "Hide details to see map";

  /* ---------------------------- Render ---------------------------- */
  return (
    <section
      ref={sheetRef}
      className={`nx-bottom-sheet ${collapsed ? "is-collapsed" : "is-expanded"}`}
      style={{
        height: currentHeight,
        padding,
        // Respect iOS home bar
        paddingBottom: `calc(${typeof padding === "number" ? padding : 12}px + env(safe-area-inset-bottom))`,
      }}
      role="region"
      aria-label={title}
    >
      {/* Header row: handle + toggle + optional extra */}
      <div className="nx-sheet-header-row">
        <button
          type="button"
          className="nx-sheet-toggle"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="nx-bottom-sheet-content"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <span className="nx-sheet-handle" aria-hidden="true" />
          <span>{toggleLabel}</span>
        </button>
        {headerExtra ? (
          <div className="nx-sheet-header-extra">{headerExtra}</div>
        ) : null}
      </div>

      <div
        id="nx-bottom-sheet-content"
        className="nx-bottom-sheet-content"
        // Prevent scroll chaining to the page
        style={{ overscrollBehavior: "contain" }}
      >
        {children}
      </div>
    </section>
  );
}
