"use client";

import { useState } from "react";
import Image from "next/image";

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
  /** Fallback-Text wenn Bild nicht ladbar — locale-spezifisch ueberschreiben */
  unavailableLabel?: string;
}

export default function SafeImage({
  src,
  alt,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  priority = false,
  className,
  fill = false,
  unavailableLabel = "Image unavailable",
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className="flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-secondary)] w-full h-full absolute inset-0"
        role="status"
        aria-label={alt}
      >
        <span className="text-sm">{unavailableLabel}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      fill={fill}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
