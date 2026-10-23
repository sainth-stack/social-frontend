"use client";

import { useEffect, useRef } from "react";
import { SIGNUP_URL } from "@/content/site";

function send(event: "page_view" | "signup_click" | "contact_click") {
  void fetch("/api/marketing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "event", event }),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
  }).catch(() => undefined);
}

export function MarketingAnalytics() {
  const pageViewSent = useRef(false);

  useEffect(() => {
    if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    if (!pageViewSent.current) {
      pageViewSent.current = true;
      send("page_view");
    }
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link) return;
      if (link.href === SIGNUP_URL) send("signup_click");
      else if (link.getAttribute("href") === "#contact") send("contact_click");
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return null;
}