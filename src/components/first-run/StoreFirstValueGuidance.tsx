"use client";

import Link from "next/link";
import type { FirstValueInsight } from "@/lib/first-run/first-value";

export function StoreFirstValueGuidance({
  insight,
  onPrimaryClick,
}: {
  insight: FirstValueInsight;
  onPrimaryClick?: () => void;
}) {
  return (
    <section className="card first-run-first-value exec-first-value" aria-labelledby="exec-first-value-title">
      <p className="first-run-eyebrow">Your store is connected</p>
      <h2 id="exec-first-value-title">{insight.headline}</h2>
      <p>{insight.body}</p>

      <div className="first-run-known-grid">
        <div>
          <h3 className="first-run-section-title">What we know</h3>
          <ul className="first-run-fact-list">
            {insight.known.map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
        </div>
        {insight.unknown.length > 0 ? (
          <div>
            <h3 className="first-run-section-title">What we don&apos;t know yet</h3>
            <ul className="first-run-fact-list">
              {insight.unknown.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="first-run-next">
        <h3 className="first-run-section-title">Unlock more insights</h3>
        <p>{insight.whatToDoNext}</p>
      </div>

      <div className="first-run-decision-actions">
        <Link
          className="btn btn-primary"
          href={insight.primaryAction.href}
          onClick={onPrimaryClick}
        >
          {insight.primaryAction.label}
        </Link>
      </div>
    </section>
  );
}
