import Link from "next/link";

export function VisitorActivityPanel({ requiresGa4 }: { requiresGa4: boolean }) {
  if (!requiresGa4) {
    return (
      <section className="card analytics-live-map">
        <h3>Visitor Activity</h3>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          GA4 is connected. Real-time visitor map and active page data will appear here as session
          volume builds.
        </p>
      </section>
    );
  }

  return (
    <section className="card analytics-live-map live-visitor-education">
      <h3>Visitor Activity</h3>
      <p style={{ margin: "0 0 12px", lineHeight: 1.5, fontSize: "0.92rem" }}>
        <strong>GA4 Real-Time is not connected.</strong>
      </p>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.88rem" }}>
        After connecting GA4 you&apos;ll see:
      </p>
      <ul className="live-visitor-unlocks">
        <li>Live visitor map</li>
        <li>Active pages</li>
        <li>Traffic sources</li>
        <li>Live conversions</li>
        <li>Current checkout sessions</li>
      </ul>
      <Link href="/connections" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
        Connect GA4
      </Link>
    </section>
  );
}
