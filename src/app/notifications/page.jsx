import MobileShell from "../../components/ui/MobileShell";
import ActionCard from "../../components/ui/ActionCard";

export default function NotificationsPage() {
  const events = ["Request viewed", "Offer received", "Driver accepted", "Driver arrived", "OTP verified", "Trip started", "Trip completed"];
  return (
    <MobileShell>
      <div className="nx-profile-page">
        <a className="nx-icon-btn" href="/rider" aria-label="Back">←</a>
        <div style={{ height: 18 }} />
        <ActionCard style={{ padding: 20 }}>
          <div className="nx-eyebrow">Notifications</div>
          <h1 className="nx-auth-title" style={{ marginTop: 12 }}>Ride alerts</h1>
          <p className="nx-auth-copy">NEXRIDE is prepared for OneSignal and Render events for each major ride stage.</p>
          <div className="nx-grid" style={{ marginTop: 16 }}>
            {events.map((event) => <div className="nx-page-link-card" key={event}><span>🔔 {event}</span><strong>Ready</strong></div>)}
          </div>
        </ActionCard>
        <div className="nx-footer-brand">@NEXRIDE</div>
      </div>
    </MobileShell>
  );
}
