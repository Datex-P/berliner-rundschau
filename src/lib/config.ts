// Site configuration — single source of truth for URLs, names, and branding metadata
export const SITE_CONFIG = {
  url: "https://berliner-rundschau.de",
  name: "Berliner Rundschau",
  description:
    "Nachrichten aus Berlin und der Welt — Politik, Wirtschaft, Kultur, Sport und Meinung.",
  locale: "de-DE",
  logo: "/logo.png",
} as const;

export const IMAGE_DIMENSIONS = {
  article: { width: 1200, height: 675 },
  hero: { width: 1200, height: 514 },
  card: { width: 640, height: 360 },
  compact: { width: 80, height: 80 },
  avatar: { width: 120, height: 120 },
  video: { width: 640, height: 360 },
} as const;
