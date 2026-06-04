// File: src/components/ui/MobileShell.jsx

export default function MobileShell({ children }) {
  return (
    <main className="nx-shell">
      <div className="nx-orb nx-orb-a" />
      <div className="nx-orb nx-orb-b" />
      <div className="nx-phone-frame">{children}</div>
    </main>
  );
}
