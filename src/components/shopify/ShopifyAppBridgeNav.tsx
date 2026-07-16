"use client";

import { NavMenu } from "@shopify/app-bridge-react";

/**
 * Shopify Admin app navigation (App Bridge 4).
 * Keeps the existing in-app AppNav sidebar; this only registers Admin chrome links.
 * @see https://shopify.dev/docs/api/app-bridge-library/react-components/navmenu
 */
export function ShopifyAppBridgeNav() {
  return (
    <NavMenu>
      <a href="/" rel="home">
        Home
      </a>
      <a href="/health">Health</a>
      <a href="/advertising">Advertising</a>
      <a href="/decisions">Decisions</a>
      <a href="/connections">Connections</a>
      <a href="/settings">Settings</a>
    </NavMenu>
  );
}
