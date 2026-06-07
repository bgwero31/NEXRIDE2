import MobileShell from "../../components/ui/MobileShell";
import ActionCard from "../../components/ui/ActionCard";

export default function HelpPage() {
  const items = [
    ["Requesting a ride", "Allow GPS, enter destination, set your fare, then choose the best driver offer."],
    ["Driver mode", "Go online to receive nearby ride requests and send offers."],
    ["Live map", "The map follows the phone GPS and shows the active route when both points are available."],
    ["OTP pickup", "The rider shares the OTP with the driver after entering the car."],
  ];
  return (
    <MobileShell>
      <div className="nx-profile-page">
        <a className="nx-icon-btn" href="/rider" aria-label="Back">←</a>
        <div style={{ height: 18 }} />
        <ActionCard style={{ padding: 20 }}>
          <div className="nx-eyebrow">Help center</div>
          <h1 className="nx-auth-title" style={{ marginTop: 12 }}>How NEXRIDE works</h1>
          <div className="nx-grid" style={{ marginTop: 18 }}>
            {items.map(([title, copy]) => <div className="nx-history-item" key={title}><div className="nx-card-title">{title}</div><p className="nx-sheet-copy">{copy}</p></div>)}
          </div>
        </ActionCard>
        <div className="nx-footer-brand">@NEXRIDE</div>
      </div>
    </MobileShell>
  );
}
