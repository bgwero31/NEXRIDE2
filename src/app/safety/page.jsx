import MobileShell from "../../components/ui/MobileShell";
import ActionCard from "../../components/ui/ActionCard";

export default function SafetyPage() {
  return (
    <MobileShell>
      <div className="nx-profile-page">
        <a className="nx-icon-btn" href="/rider" aria-label="Back">←</a>
        <div style={{ height: 18 }} />
        <ActionCard style={{ padding: 20 }}>
          <div className="nx-eyebrow">NEXRIDE safety</div>
          <h1 className="nx-auth-title" style={{ marginTop: 12 }}>Safety and respect for all</h1>
          <p className="nx-auth-copy">Every rider and driver should feel safe, respected and protected during every trip.</p>
          <div className="nx-grid" style={{ marginTop: 18 }}>
            <div className="nx-page-link-card"><span>✓ Treat everyone with kindness and respect</span></div>
            <div className="nx-page-link-card"><span>✓ Confirm plate, driver name and OTP before pickup</span></div>
            <div className="nx-page-link-card"><span>✓ Follow the law and keep trips professional</span></div>
            <div className="nx-page-link-card"><span>✓ Use support if something feels wrong</span></div>
          </div>
        </ActionCard>
        <a className="nx-btn nx-btn-primary" style={{ marginTop: 14 }} href="/rider">I understand</a>
        <div className="nx-footer-brand">@NEXRIDE</div>
      </div>
    </MobileShell>
  );
}
