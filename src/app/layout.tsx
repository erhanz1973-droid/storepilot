import { AppNav } from "@/components/AppNav";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { EmbeddedShopifyBootstrap } from "@/components/shopify/EmbeddedShopifyBootstrap";
import { ShopifyAppBridgeNav } from "@/components/shopify/ShopifyAppBridgeNav";
import { marketingSiteMetadata } from "@/lib/marketing/metadata";
import { isMarketingRequest } from "@/lib/marketing/site";
import { resolveShopifyAppBridgeApiKey } from "@/lib/shopify/app-bridge-config";
import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  if (await isMarketingRequest()) {
    return marketingSiteMetadata;
  }
  return {
    title: "StorePilot AI",
    description: "Multi-platform commerce intelligence — analyze and recommend, never auto-act",
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const marketing = await isMarketingRequest();
  const appBridgeApiKey = marketing ? null : resolveShopifyAppBridgeApiKey();

  if (marketing) {
    return (
      <html lang="en">
        <body>
          <MarketingShell>{children}</MarketingShell>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        {/* App Bridge 4 — first script, no async/defer (Shopify requirement). */}
        {appBridgeApiKey ? (
          <script
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            data-api-key={appBridgeApiKey}
          />
        ) : null}
      </head>
      <body>
        <EmbeddedShopifyBootstrap />
        {appBridgeApiKey ? <ShopifyAppBridgeNav /> : null}
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
