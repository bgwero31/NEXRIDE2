// File: src/components/ui/MobileShell.jsx
/**
 * Full-viewport NEXRIDE shell.
 * Adds ambient gradient orbs + centers the mobile frame.
 * Pass `className` to extend, `decorators={false}` to skip orbs.
 */
export default function MobileShell({
  children,
  className = "",
  decorators = true,
  ...rest
}) {
  const classes = `nx-shell ${className}`.trim();
  return (
    <main className={classes} {...rest}>
      {decorators ? (
        <>
          <div className="nx-orb nx-orb-a" aria-hidden="true" />
          <div className="nx-orb nx-orb-b" aria-hidden="true" />
        </>
      ) : null}
      <div className="nx-phone-frame">{children}</div>
    </main>
  );
}
