"use client";

import { useState } from "react";
import NexrideBrand from "./NexrideBrand";

function menuItems(role) {
  const opposite = role === "driver" ? { href: "/rider", label: "Rider mode", icon: "🚘" } : { href: "/driver", label: "Driver mode", icon: "🚖" };
  return [
    { href: "/profile", label: "Profile", icon: "👤" },
    { href: "/school", label: "School transport", icon: "🏫" },
    { href: "/permissions", label: "Device permissions", icon: "✅" },
    { href: "/profile#history", label: "Completed rides", icon: "🕘" },
    opposite,
    { href: "/notifications", label: "Notifications", icon: "🔔" },
    { href: "/safety", label: "Safety", icon: "🛡️" },
    { href: "/settings", label: "Settings", icon: "⚙️" },
    { href: "/help", label: "Help", icon: "ⓘ" },
    { href: "/support", label: "Support", icon: "💬" },
  ];
}

export default function FloatingTopBar({
  title = "NEXRIDE",
  subtitle = "",
  right = null,
  showSettings = true,
  settingsHref = "/settings",
  avatarUrl = "",
  role = "rider",
  onLogout = null,
}) {
  const [open, setOpen] = useState(false);
  const modeHref = role === "driver" ? "/rider" : "/driver";
  const modeCopy = role === "driver" ? "Switch to rider mode" : "Switch to driver mode";
  const displayName = title === "NEXRIDE" && subtitle ? subtitle.split("•")[0].trim() : title;

  return (
    <>
      <div className="nx-topbar nx-glass-panel">
        <div className="nx-topbar-inner">
          <a href={role === "driver" ? "/driver" : "/rider"} className="nx-topbar-brand" aria-label="Open NEXRIDE home">
            <NexrideBrand size="small" subtitle={subtitle || title} avatarUrl={avatarUrl} />
          </a>

          <div className="nx-topbar-actions">
            {right}
            <button type="button" className="nx-icon-btn nx-menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
              ☰
            </button>
          </div>
        </div>
      </div>

      {open ? <button className="nx-app-drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`nx-app-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="nx-drawer-profile">
          <div className="nx-drawer-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : (title || "N").slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="nx-drawer-name">{displayName || "NEXRIDE"}</div>
            <div className="nx-drawer-subtitle">{subtitle || "Your ride account"}</div>
          </div>
        </div>

        <div className="nx-drawer-list">
          {menuItems(role).map((item) => (
            <a key={item.href} href={item.href} className="nx-drawer-link" onClick={() => setOpen(false)}>
              <span className="nx-drawer-icon">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>

        <div className="nx-drawer-footer">
          <a href={modeHref} className="nx-drawer-mode">{modeCopy}</a>
          {onLogout ? (
            <button type="button" onClick={onLogout} className="nx-drawer-logout">
              <span className="nx-drawer-icon">↩</span>
              <span>Logout</span>
            </button>
          ) : null}
          <div>@NEXRIDE</div>
        </div>
      </aside>
    </>
  );
}
