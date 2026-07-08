interface SecurityHeader {
  key: string;
  value: string;
}

export function securityHeaders(): SecurityHeader[] {
  const isDev = process.env.NODE_ENV === "development";

  const cmsImgSources = (process.env.CMS_IMAGE_DOMAINS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) =>
      h.includes(".ddev.site") || h.includes("localhost")
        ? `http://${h}`
        : `https://${h}`,
    );

  const imgSrc = ["'self'", "data:", "https:", ...cmsImgSources].join(" ");

  return [
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        `img-src ${imgSrc}`,
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; "),
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
}
