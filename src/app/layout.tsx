import { AppNav } from "@/components/AppNav";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { ensureEmbeddedShopifyBootstrap } from "@/lib/shopify/embedded-bootstrap.server";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StorePilot AI",
  description: "Multi-platform commerce intelligence — analyze and recommend, never auto-act",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  try {
    await ensureEmbeddedShopifyBootstrap();
  } catch (error) {
    // Shopify authenticate.admin() throws Response for App Bridge / bounce redirects.
    if (error instanceof Response) throw error;
    console.error("[embedded-bootstrap] layout bootstrap failed (non-fatal)", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <AppNav />
          <div className="app-content">
            <DemoDataBadge />
            <main className="app-main">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
