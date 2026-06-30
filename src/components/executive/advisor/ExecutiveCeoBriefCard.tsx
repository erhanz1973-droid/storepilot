import type { CeoBrief } from "@/lib/analytics/executive-advisor";

export function ExecutiveCeoBriefCard({ brief }: { brief: CeoBrief }) {
  return (
    <section className="exec-advisor-ceo-brief card">
      <h2 className="exec-advisor-section-title">CEO Brief</h2>
      <p className="exec-briefing-greeting">{brief.greeting}.</p>
      <div className="exec-advisor-ceo-conversation">
        {brief.conversation.map((line) => (
          <p key={line} className="exec-advisor-ceo-line">
            {line}
          </p>
        ))}
      </div>
      {brief.closingLine && (
        <p className="exec-advisor-ceo-closing">{brief.closingLine}</p>
      )}
    </section>
  );
}
