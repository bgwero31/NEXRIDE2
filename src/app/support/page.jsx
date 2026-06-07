import MobileShell from "../../components/ui/MobileShell";
import ActionCard from "../../components/ui/ActionCard";

export default function SupportPage() {
  return (
    <MobileShell>
      <div className="nx-profile-page">
        <a className="nx-icon-btn" href="/rider" aria-label="Back">←</a>
        <div style={{ height: 18 }} />
        <ActionCard style={{ padding: 20 }}>
          <div className="nx-eyebrow">Support</div>
          <h1 className="nx-auth-title" style={{ marginTop: 12 }}>Need help?</h1>
          <p className="nx-auth-copy">Use these quick support links while we connect live chat and admin support.</p>
          <div className="nx-grid">
            <a className="nx-page-link-card" href="tel:+263000000000"><span>📞 Call support</span><strong>›</strong></a>
            <a className="nx-page-link-card" href="mailto:support@nexride.co.zw"><span>✉ Email support</span><strong>›</strong></a>
            <a className="nx-page-link-card" href="/safety"><span>🛡 Safety issue</span><strong>›</strong></a>
          </div>
        </ActionCard>
        <a className="nx-btn nx-btn-primary" style={{ marginTop: 14 }} href="/profile">Open profile</a>
        <div className="nx-footer-brand">@NEXRIDE</div>
      </div>
    </MobileShell>
  );
}
