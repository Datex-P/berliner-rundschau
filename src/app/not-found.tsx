import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-[var(--color-text)] mb-4">404</h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        Die angeforderte Seite wurde nicht gefunden.
      </p>
      <Link
        href="/"
        className="px-6 py-2 bg-[var(--color-primary)] text-[var(--color-text-inverse)] rounded-lg font-medium hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
      >
        Zur Startseite
      </Link>
    </div>
  );
}
