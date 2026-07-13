import { AppNav } from "@/components/AppNav";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { EmbeddedShopifyBootstrap } from "@/components/shopify/EmbeddedShopifyBootstrap";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StorePilot AI",
  description: "Multi-platform commerce intelligence — analyze and recommend, never auto-act",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EmbeddedShopifyBootstrap />
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
