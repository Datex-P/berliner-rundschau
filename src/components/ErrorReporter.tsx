"use client";

import { useEffect } from "react";

export function ErrorReporter() {
  useEffect(() => {
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      console.error("[Unhandled Rejection]", e.reason);
    };
    const onError = (e: ErrorEvent) => {
      console.error("[Window Error]", e.error ?? e.message);
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
