"use client";

import { useState } from "react";
import { redirectTop } from "@/lib/shopify/embedded-navigation";
import {
  normalizeMarketingShopDomain,
  resolveShopifyAuthStartUrl,
} from "@/lib/marketing/shopify-start";
import { trackMetaEvent } from "@/lib/marketing/track-client";

export function StartFreeForm({
  id,
  variant = "hero",
}: {
  id?: string;
  variant?: "hero" | "footer";
}) {
  const [shop, setShop] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const domain = normalizeMarketingShopDomain(shop);
    if (!domain) {
      setError("Enter your Shopify store domain.");
      return;
    }
    if (!domain.endsWith(".myshopify.com")) {
      setError("Use your myshopify.com domain, for example your-store.myshopify.com.");
      return;
    }
    setError(null);
    trackMetaEvent("SignUp", { method: "shopify_oauth" });
    const startUrl = resolveShopifyAuthStartUrl(domain, window.location.origin);
    redirectTop(startUrl);
  }

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className={`marketing-start-form marketing-start-form-${variant}`}
      aria-label="Connect your Shopify store"
    >
      <label className="marketing-start-label" htmlFor={id ? `${id}-shop` : "shop-domain"}>
        Shopify store domain
      </label>
      <div className="marketing-start-row">
        <input
          id={id ? `${id}-shop` : "shop-domain"}
          type="text"
          name="shop"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="your-store.myshopify.com"
          autoComplete="off"
          spellCheck={false}
          className="marketing-start-input"
          required
        />
        <button type="submit" className="btn btn-primary marketing-start-submit">
          Start Free
        </button>
      </div>
      {error ? (
        <p className="marketing-start-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="marketing-cta-note">No credit card required.</p>
    </form>
  );
}
