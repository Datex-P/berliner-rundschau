import type { NextConfig } from "next";
import { securityHeaders } from "@/lib/security-headers";

const leaked = Object.keys(process.env).filter(
  (k) => k.startsWith("NEXT_PUBLIC_") && /(TOKEN|SECRET|KEY|PASSWORD)/i.test(k),
);
if (leaked.length > 0) {
  throw new Error(
    `[security] CMS tokens with NEXT_PUBLIC_ prefix would leak to client bundle: ${leaked.join(", ")}`,
  );
}

const cmsImageDomains: {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
}[] = (process.env.CMS_IMAGE_DOMAINS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)
  .flatMap((entry) => {
    const [hostname, port] = entry.split(":");
    const isLocal =
      hostname.includes(".ddev.site") || hostname.includes("localhost");
    const base = { hostname, ...(port ? { port } : {}) };
    return isLocal
      ? [
          { protocol: "http" as const, ...base },
          { protocol: "https" as const, ...base },
        ]
      : [{ protocol: "https" as const, ...base }];
  });

const typo3Url = (process.env.TYPO3_URL ?? "").replace(/\/$/, "");
const isLocalTypo3 =
  typo3Url.includes(".ddev.site") || typo3Url.includes("localhost");

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  cacheLife: {
    editorial: {
      stale: 300,
      revalidate: 3600,
      expire: 86400,
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      ...cmsImageDomains,
    ],
    formats: ["image/avif", "image/webp"],
    qualities: [50, 75, 100],
    minimumCacheTTL: 31536000,
    deviceSizes: [384, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128],
  },

  async rewrites() {
    if (!typo3Url || !isLocalTypo3) return [];
    return [
      {
        source: "/cms-proxy/fileadmin/:path*",
        destination: `${typo3Url}/fileadmin/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders(),
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
