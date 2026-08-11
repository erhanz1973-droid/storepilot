"use client";

import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/marketing/track-client";

export function LandingTracker() {
  useEffect(() => {
    trackMetaEvent("ViewContent", {
      content_name: "StorePilot AI Landing",
      content_category: "AI Store Manager",
    });
  }, []);

  return null;
}
