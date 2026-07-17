import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

export function ConnectGoogleAdsButton({ compact = false }: { compact?: boolean }) {
  return (
    <TopLevelOAuthLink
      href="/api/google/auth"
      className={`btn ${compact ? "btn-secondary" : "btn-primary"}`}
    >
      Connect Google Ads
    </TopLevelOAuthLink>
  );
}
