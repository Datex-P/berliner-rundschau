"use client";

import Image from "next/image";
import { useState } from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Responsive sizes — Default deckt gaengige Layouts ab */
  sizes?: string;
  /** Fuer Above-the-Fold-Bilder (Hero, erster Artikel) */
  priority?: boolean;
  className?: string;
  /** Next.js Image fill-Modus (ignoriert width/height) */
  fill?: boolean;
  /** Bildqualitaet 1-100 (Default 75) */
  quality?: number;
  /** Fallback-Text wenn Bild nicht ladbar — locale-spezifisch ueberschreiben */
  unavailableLabel?: string;
}

export default function SafeImage({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className,
  fill = false,
  quality,
  unavailableLabel = "Image unavailable",
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className="flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-secondary)] w-full h-full"
        role="status"
        aria-label={alt}
      >
        <span className="text-sm">{unavailableLabel}</span>
      </div>
    );
  }

  // Localhost-URLs (Strapi dev): Next.js image optimizer blockiert private IPs (SSRF-Schutz).
  // unoptimized lässt den Browser direkt fetchen — nur in dev relevant.
  const isLocalhost =
    src.startsWith("http://localhost") || src.startsWith("http://127.0.0.1");

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      fetchPriority={priority ? "high" : undefined}
      fill={fill}
      quality={quality}
      className={className}
      unoptimized={isLocalhost}
      onError={() => setHasError(true)}
    />
  );
}
