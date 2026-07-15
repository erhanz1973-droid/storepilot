"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft-gate unfinished merchants to /first-run without throwing a server redirect. */
export function FirstRunClientRedirect({ shouldRedirect }: { shouldRedirect: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace("/first-run");
  }, [shouldRedirect, router]);

  if (!shouldRedirect) return null;

  return (
    <div className="card" style={{ padding: 24 }} role="status" aria-busy="true">
      <p style={{ margin: 0 }}>Preparing your first-run briefing…</p>
    </div>
  );
}
