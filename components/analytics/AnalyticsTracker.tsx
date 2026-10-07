"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { buildPageview } from "@/lib/analytics/event";
import { sendPageview } from "@/lib/analytics/send";
import { safeLocalStorage } from "@/lib/analytics/storage";

/** Records one pageview per route change. Renders nothing. */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    const event = buildPageview({
      pathname,
      hostname: window.location.hostname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver === true,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      screenWidth: window.screen.width,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      isProduction: process.env.NODE_ENV === "production",
      storage: safeLocalStorage(),
      firstView: firstView.current,
    });
    firstView.current = false;
    if (event) void sendPageview(event);
  }, [pathname]);

  return null;
}
