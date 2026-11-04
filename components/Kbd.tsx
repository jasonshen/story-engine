/** A keyboard-shortcut hint. Hidden on touch-only devices via CSS. */
export default function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="kbd" aria-hidden="true">
      {children}
    </kbd>
  );
}
