"use client";

import { useState } from "react";
import { redirectTop } from "@/lib/shopify/embedded-navigation";

export function ConnectShopifyForm() {
  const [shop, setShop] = useState("");

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!shop.trim()) return;
    const domain = shop.includes(".") ? shop : `${shop}.myshopify.com`;
    // OAuth must leave the Admin iframe (App Bridge Navigation API).
    redirectTop(`/api/shopify/auth?shop=${encodeURIComponent(domain)}`);
  }

  return (
    <form onSubmit={handleConnect} className="stack" style={{ maxWidth: 400 }}>
      <p className="muted" style={{ margin: 0 }}>
        Enter your Shopify store domain to install StorePilot AI. You will be redirected to Shopify
        to approve access.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="muted">Store domain</span>
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="your-store.myshopify.com"
          className="shop-input"
          required
        />
      </label>
      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Connect Shopify Store
      </button>
    </form>
  );
}
