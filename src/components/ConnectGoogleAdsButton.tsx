import Link from "next/link";

export function ConnectGoogleAdsButton({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/api/google/auth" className={`btn ${compact ? "btn-secondary" : "btn-primary"}`}>
      Connect Google Ads
    </Link>
  );
}
