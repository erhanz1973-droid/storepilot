export function AutopilotVisionBanner({ statement }: { statement: string }) {
  return (
    <section className="card autopilot-ops-vision-card">
      <p className="autopilot-ops-eyebrow">Future vision</p>
      <h3>From rules to an AI Chief Operating Officer</h3>
      <p className="autopilot-ops-vision-copy">{statement}</p>
      <p className="muted autopilot-ops-vision-tagline">
        You don&apos;t configure rules — you approve high-confidence business decisions.
      </p>
    </section>
  );
}
