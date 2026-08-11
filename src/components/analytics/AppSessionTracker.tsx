"use client";

import { useEffect } from "react";
import { ACTIVATION_EVENTS, activationTrackPayload } from "@/lib/analytics/activation-events";

/**
 * Records a real UI session (`app_opened`) once per browser tab session.
 * Webhook / last_sync activity is not a merchant session.
 */
export function AppSessionTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("storepilot_app_opened") === "1") return;
      sessionStorage.setItem("storepilot_app_opened", "1");
    } catch {
      // private mode — still fire once this mount
    }
    void fetch("/api/first-run/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: ACTIVATION_EVENTS.appOpened,
        props: activationTrackPayload({ source: "app_shell" }),
      }),
    }).catch(() => undefined);
  }, []);

  return null;
}
