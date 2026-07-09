// Default srHintLabel ist English — in anderen Locales srHintLabel explizit setzen.

import type { ReactNode } from "react";

interface ExternalLinkProps {
  href: string;
  className?: string;
  srHintLabel?: string;
  children: ReactNode;
}

export default function ExternalLink({
  href,
  className,
  srHintLabel = "(opens in new tab)",
  children,
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <span className="sr-only">{srHintLabel}</span>
    </a>
  );
}
