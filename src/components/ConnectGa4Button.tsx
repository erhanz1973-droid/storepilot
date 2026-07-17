import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

export function ConnectGa4Button({ compact = false }: { compact?: boolean }) {
  return (
    <TopLevelOAuthLink
      href="/api/ga4/auth"
      className={`btn ${compact ? "btn-secondary" : "btn-primary"}`}
    >
      Connect GA4
    </TopLevelOAuthLink>
  );
}
