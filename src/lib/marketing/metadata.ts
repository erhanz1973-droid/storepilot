import type { Metadata } from "next";
import { MARKETING_SITE_URL } from "./site";

const OG_IMAGE = `${MARKETING_SITE_URL}/images/logo.png`;

const TITLE = "StorePilot AI — Your AI Store Manager for Shopify";
const DESCRIPTION =
  "StorePilot AI analyzes your Shopify store, profitability and advertising to tell you what to do next.";

export const marketingSiteMetadata: Metadata = {
  metadataBase: new URL(MARKETING_SITE_URL),
  title: {
    default: TITLE,
    template: "%s | StorePilot AI",
  },
  description: DESCRIPTION,
  alternates: {
    canonical: MARKETING_SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: MARKETING_SITE_URL,
    siteName: "StorePilot AI",
    title: TITLE,
    description: DESCRIPTION,
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
    title: TITLE,
    description: DESCRIPTION,
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
