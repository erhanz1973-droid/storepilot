"use client";

import type { FirstRunDecision } from "@/lib/first-run/types";

export function FirstRunWhyPanel({ decision }: { decision: FirstRunDecision }) {
  const { why, evidencePoints } = decision;
  return (
    <section className="card first-run-why" aria-label="Why this recommendation">
      <h3 style={{ marginTop: 0 }}>Why StorePilot is recommending this</h3>
      <ul className="first-run-why-stats">
        <li>
          <strong>{why.productsAnalyzed.toLocaleString()}</strong> products analyzed
        </li>
        <li>
          <strong>{why.ordersAnalyzed.toLocaleString()}</strong> orders analyzed
        </li>
        <li>
          <strong>{why.campaignsAnalyzed.toLocaleString()}</strong> campaigns analyzed
        </li>
      </ul>
      <p>{decision.whyThisMatters}</p>
      <p>{why.confidenceSummary}</p>
      {evidencePoints.length > 0 ? (
        <>
          <p className="muted" style={{ marginBottom: 6 }}>
            Based on
          </p>
          <ul>
            {evidencePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>What to do next</h3>
      <p className="muted" style={{ marginBottom: 0 }}>
        {decision.whatToDoNext}
      </p>
    </section>
  );
}
