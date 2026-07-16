"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  isShopifyEmbeddedContext,
  redirectTop,
} from "@/lib/shopify/embedded-navigation";

/**
 * Triggers Shopify authenticate.admin via Route Handler (cookie-safe).
 * Never call authenticate.admin from RSC / layout.tsx.
 */
export function EmbeddedShopifyBootstrap() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!isShopifyEmbeddedContext()) return;
    started.current = true;

    const search = window.location.search || "";
    const url = `/api/shopify/bootstrap${search}`;

    console.log("[embedded-bootstrap] client fetch start", { url });

    void fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        // Preserve current document URL for session-token reconstruction.
        "x-storepilot-request-url": window.location.href,
      },
      redirect: "manual",
    })
      .then(async (response) => {
        // Shopify may bounce/redirect for session token exchange.
        if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
          const location = response.headers.get("location");
          console.log("[embedded-bootstrap] client received redirect", {
            status: response.status,
            location,
          });
          if (location) {
            // Exit iframe when Shopify sends a remote/OAuth bounce URL.
            redirectTop(location);
            return;
          }
        }

        if (response.status === 200 && response.headers.get("content-type")?.includes("text/html")) {
          // App Bridge bounce HTML — load it in this frame.
          const html = await response.text();
          document.open();
          document.write(html);
          document.close();
          return;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          console.error("[embedded-bootstrap] client fetch failed", {
            status: response.status,
            text: text.slice(0, 200),
          });
          return;
        }

        const payload = (await response.json()) as {
          ok?: boolean;
          skipped?: boolean;
          storeId?: string | null;
          shop?: string;
        };

        console.log("[embedded-bootstrap] client fetch complete", payload);

        if (payload.ok && !payload.skipped && payload.storeId) {
          router.refresh();
        }
      })
      .catch((error: unknown) => {
        console.error("[embedded-bootstrap] client fetch exception", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }, [router]);

  return null;
}
