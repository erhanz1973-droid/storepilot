import type { Metadata } from "next";
import { MARKETING_SITE_URL } from "./site";

const OG_IMAGE = `${MARKETING_SITE_URL}/images/logo.png`;

export const marketingSiteMetadata: Metadata = {
  metadataBase: new URL(MARKETING_SITE_URL),
  title: {
    default: "StorePilot AI | Shopify Analytics & AI Insights",
    template: "%s | StorePilot AI",
  },
  description:
    "Analyze sales, advertising and profitability with AI-powered insights for Shopify.",
  alternates: {
    canonical: MARKETING_SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: MARKETING_SITE_URL,
    siteName: "StorePilot AI",
    title: "StorePilot AI | Shopify Analytics & AI Insights",
    description:
      "Analyze sales, advertising and profitability with AI-powered insights for Shopify.",
    images: [
      {
        url: OG_IMAGE,
        width: 512,
        height: 512,
        alt: "StorePilot AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StorePilot AI | Shopify Analytics & AI Insights",
    description:
      "Analyze sales, advertising and profitability with AI-powered insights for Shopify.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export function marketingPageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const url = `${MARKETING_SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [{ url: OG_IMAGE, width: 512, height: 512, alt: "StorePilot AI" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}
