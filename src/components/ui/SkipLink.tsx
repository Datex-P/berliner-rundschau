// Default-Label ist English — in anderen Locales label explizit setzen.
// label explizit setzen (z.B. label="Zum Inhalt springen" in de-DE layout).

interface SkipLinkProps {
  /** ID des Ziel-Elements (ohne #) */
  targetId?: string;
  /** Sichtbarer Text beim Fokus — locale-spezifisch ueberschreiben */
  label?: string;
}

export default function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      {label}
    </a>
  );
}
