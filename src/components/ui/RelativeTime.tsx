"use client";

import { useState, useEffect } from "react";
import { formatDate, formatRelativeDate } from "@/lib/format";

interface RelativeTimeProps {
  dateTime: string;
  className?: string;
}

export default function RelativeTime({
  dateTime,
  className,
}: RelativeTimeProps) {
  const [display, setDisplay] = useState(() => formatDate(dateTime));

  useEffect(() => {
    setDisplay(formatRelativeDate(dateTime));
  }, [dateTime]);

  return (
    <time dateTime={dateTime} className={className} suppressHydrationWarning>
      {display}
    </time>
  );
}
