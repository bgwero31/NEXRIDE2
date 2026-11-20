// File: src/components/ui/FloatingTopBar.jsx

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NexrideBrand from "./NexrideBrand";

/* ------------------------------ Icons --------------------------------- */

const ICON = {
  profile: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  school: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
};

/* --------------------------- Menu builder ----------------------------- */

function menuItems(role) {
  const opposite =
    role === "driver"
      ? { href: "/rider", label: "Rider mode", icon: ICON.swap }
      : { href: "/driver", label: "Driver mode", icon: ICON.swap };

  return [
    { href: "/profile", label: "Profile", icon: ICON.profile },
    { href: "/school", label: "School transport", icon: ICON.school },
    { href: "/permissions", label: "Device permissions", icon: ICON.shield },
    { href: "/profile#history", label: "Completed rides", icon: ICON.history },
    opposite,
    { href: "/notifications", label: "Notifications", icon: ICON.bell },
    { href: "/settings", label: "Settings", icon: ICON.settings },
    { href: "/help", label: "Help", icon: ICON.help },
    { href: "/support", label: "Support", icon: ICON.chat },
  ];
}

/* --------------------------- Helpers ---------------------------------- */

function safeSplitName(subtitle) {
  if (!subtitle || typeof subtitle !== "string") return "";
  return subtitle.split("•")[0].trim();
}

/* ---------------------------- Component ------------------------------- */

export default function FloatingTopBar({
  title = "NEXRIDE",
  subtitle = "",
  right = null,
  showSettings = true,
  settingsHref = "/settings",
  avatarUrl = "",
  role = "rider",
  onLogout = null,
  userEmail = "",     // optional — shown in drawer
  userPhone = "",     // optional
}) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef(null);
  const firstLinkRef = useRef(null);

  const modeHref = role === "driver" ? "/rider" : "/driver";
  const modeCopy =
    role === "driver" ? "Switch to rider mode" : "Switch to driver mode";
  const homeHref = role === "driver" ? "/driver" : "/rider";
  const displayName =
    title === "NEXRIDE" && subtitle
      ? safeSplitName(subtitle) || title
      : title;

  /* --------------------------- Close on route change ---------------- */
  useEffect(() => {
    setOpen(false);
    setConfirmLogout(false);
  }, [pathname]);

  /* ------------------------------ Escape key ------------------------ */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* ----------------------- Body scroll lock ------------------------- */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  /* -------------------- Focus first link on open -------------------- */
  useEffect(() => {
    if (open && firstLinkRef.current) {
      // Slight delay so the transition completes and focus is stable.
      const t = setTimeout(() => firstLinkRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  /* --------------------------- Logout flow -------------------------- */
  const handleLogout = useCallback(() => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    setConfirmLogout(false);
    setOpen(false);
    onLogout?.();
  }, [confirmLogout, onLogout]);

  const isActive = (href) => {
    if (!pathname) return false;
    if (href.includes("#")) return pathname === href.split("#")[0];
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  /* ---------------------------- Render ------------------------------ */
  return (
    <>
      {/* Top bar */}
      <header className="nx-topbar nx-glass-panel">
        <div className="nx-topbar-inner">
          <Link
            href={homeHref}
            className="nx-topbar-brand"
            aria-label="Open NEXRIDE home"
          >
            <NexrideBrand
              size="small"
              subtitle={subtitle || title}
              avatarUrl={avatarUrl}
            />
          </Link>

          <div className="nx-topbar-actions">
            {right}
            <button
              type="button"
              className="nx-icon-btn nx-menu-btn"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              {ICON.menu}
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <button
        type="button"
        className={`nx-app-drawer-backdrop ${open ? "open" : ""}`}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={() => {
          setOpen(false);
          setConfirmLogout(false);
        }}
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className={`nx-app-drawer ${open ? "open" : ""}`}
        aria-label="Main menu"
        aria-hidden={!open}
        // Ensure the drawer is not focusable while hidden
        {...(!open ? { inert: "" } : {})}
      >
        {/* Header: avatar + name + role badge */}
        <div className="nx-drawer-profile">
          <div className="nx-drawer-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              (displayName || "N").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="nx-drawer-identity">
            <div className="nx-drawer-name">{displayName || "NEXRIDE"}</div>
            <div className="nx-drawer-subtitle">
              {userPhone || userEmail || subtitle || "Your ride account"}
            </div>
            <span
              className={`nx-drawer-role nx-drawer-role-${role}`}
            >
              {role === "driver" ? "DRIVER" : "RIDER"}
            </span>
          </div>

          <button
            type="button"
            className="nx-drawer-close"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            {ICON.close}
          </button>
        </div>

        {/* Menu items */}
        <nav className="nx-drawer-list">
          {menuItems(role).map((item, index) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                ref={index === 0 ? firstLinkRef : null}
                href={item.href}
                className={`nx-drawer-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <span className="nx-drawer-icon">{item.icon}</span>
                <span className="nx-drawer-label">{item.label}</span>
                <span className="nx-drawer-chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="nx-drawer-footer">
          <Link
            href={modeHref}
            className="nx-drawer-mode"
            onClick={() => setOpen(false)}
          >
            {ICON.swap}
            <span>{modeCopy}</span>
          </Link>

          {onLogout ? (
            confirmLogout ? (
              <div className="nx-drawer-confirm">
                <div className="nx-drawer-confirm-text">Log out?</div>
                <div className="nx-drawer-confirm-actions">
                  <button
                    type="button"
                    className="nx-drawer-confirm-btn ghost"
                    onClick={() => setConfirmLogout(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="nx-drawer-confirm-btn danger"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="nx-drawer-logout"
              >
                <span className="nx-drawer-icon">{ICON.logout}</span>
                <span>Log out</span>
              </button>
            )
          ) : null}

          <div className="nx-drawer-footer-brand">
            <span>@NEXRIDE</span>
            <span className="nx-drawer-footer-version">v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
    }
