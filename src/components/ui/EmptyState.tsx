import Link from "next/link";

export function EmptyState({
  title,
  description,
  reason,
  nextStep,
  cta,
}: {
  title: string;
  description?: string;
  /** Why data is missing */
  reason?: string;
  /** What StorePilot will do after the gap is fixed */
  nextStep?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <p style={{ margin: 0, fontWeight: 500 }}>{title}</p>
      {description ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {description}
        </p>
      ) : null}
      {reason ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {reason}
        </p>
      ) : null}
      {nextStep ? (
        <p style={{ marginTop: 8, marginBottom: 0 }}>{nextStep}</p>
      ) : null}
      {cta ? (
        <p style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href={cta.href} className="btn btn-secondary">
            {cta.label}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
