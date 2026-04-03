"use client";

import { useEffect } from "react";

export default function PwaInstaller() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Keep the app usable even if service worker registration fails.
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
