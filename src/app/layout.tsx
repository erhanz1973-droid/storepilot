import { AppNav } from "@/components/AppNav";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { EmbeddedShopifyBootstrap } from "@/components/shopify/EmbeddedShopifyBootstrap";
import { ShopifyAppBridgeNav } from "@/components/shopify/ShopifyAppBridgeNav";
import { resolveShopifyAppBridgeApiKey } from "@/lib/shopify/app-bridge-config";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StorePilot AI",
  description: "Multi-platform commerce intelligence — analyze and recommend, never auto-act",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appBridgeApiKey = resolveShopifyAppBridgeApiKey();

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
