// File: src/components/ui/BottomSheet.jsx

export default function BottomSheet({ children, height = "18vh", padding = 12 }) {
  return (
    <section className="nx-bottom-sheet" style={{ minHeight: height, padding }}>
      <div className="nx-sheet-handle" />
      {children}
    </section>
  );
}
