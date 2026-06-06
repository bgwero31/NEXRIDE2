// File: src/components/ui/FloatingTopBar.jsx

import NexrideBrand from "./NexrideBrand";

export default function FloatingTopBar({
  title = "NEXRIDE",
  subtitle = "",
  right = null,
  showSettings = true,
  settingsHref = "/settings",
  avatarUrl = "",
}) {
  return (
    <div className="nx-topbar nx-glass-panel">
      <div className="nx-topbar-inner">
        <a href="/rider" className="nx-topbar-brand" aria-label="Open NEXRIDE home">
          <NexrideBrand size="small" subtitle={subtitle || title} avatarUrl={avatarUrl} />
        </a>

        <div className="nx-topbar-actions">
          {showSettings ? (
            <a href={settingsHref} className="nx-icon-btn" aria-label="Open settings">
              ⚙
            </a>
          ) : null}
          {right}
        </div>
      </div>
    </div>
  );
}
