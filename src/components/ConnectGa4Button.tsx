import Link from "next/link";

export function ConnectGa4Button({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/api/ga4/auth" className={`btn ${compact ? "btn-secondary" : "btn-primary"}`}>
      Connect GA4
    </Link>
  );
}
