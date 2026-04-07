// File: src/components/ui/MobileShell.jsx

export default function MobileShell({ children }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background:
          "radial-gradient(circle at top, rgba(0,198,255,0.10), transparent 24%), linear-gradient(180deg, #03060b 0%, #07101b 48%, #04070d 100%)",
        color: "#f5fbff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100vh",
          position: "relative",
          background: "transparent",
        }}
      >
        {children}
      </div>
    </main>
  );
          }
