"use client";

import type { CSSProperties, ReactNode } from "react";
import { redirectTop } from "@/lib/shopify/embedded-navigation";

/**
 * OAuth must start with a top-level navigation: inside the Shopify Admin
 * iframe the SameSite=Lax state cookie set by /api/(meta|google|ga4)/auth is
 * rejected as third-party, and the provider callback then fails with
 * invalid_state. Renders a normal anchor but escapes the iframe on click.
 */
export function TopLevelOAuthLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_top"
      className={className}
      style={style}
      onClick={(event) => {
        event.preventDefault();
        redirectTop(href);
      }}
    >
      {children}
    </a>
  );
}
