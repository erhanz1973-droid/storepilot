"use client";

import type { FirstRunFirstValue } from "@/lib/first-run/types";

export function FirstRunLowDataCard({
  firstValue,
  onPrimary,
  onGrow,
}: {
  firstValue: FirstRunFirstValue;
  onPrimary: () => void;
  onGrow?: () => void;
}) {
  return (
    <section className="card first-run-first-value" aria-labelledby="first-run-low-data-title">
      <p className="first-run-eyebrow">Your store is connected</p>
      <h1 id="first-run-low-data-title" style={{ marginTop: 6 }}>
        {firstValue.headline}
      </h1>
      <p className="first-run-lede">{firstValue.body}</p>

      <div className="first-run-known-grid">
        <div>
          <h3 className="first-run-section-title">What we know</h3>
          <ul className="first-run-fact-list">
            {firstValue.known.map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
        </div>
        {firstValue.unknown.length > 0 ? (
          <div>
            <h3 className="first-run-section-title">What we don&apos;t know yet</h3>
            <ul className="first-run-fact-list">
              {firstValue.unknown.map((row) => (
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
        <h3 className="first-run-section-title">Get more insights</h3>
        <ol className="first-run-next-list">
          {firstValue.nextActions.map((action) => (
            <li key={action.label}>{action.label}</li>
          ))}
          <li>Return after your first sales</li>
        </ol>
      </div>

      <div className="first-run-decision-actions">
        <button type="button" className="btn btn-primary" onClick={onPrimary}>
          {firstValue.primaryAction.label}
        </button>
        {onGrow ? (
          <button type="button" className="btn btn-secondary" onClick={onGrow}>
            See your growth plan
          </button>
        ) : null}
      </div>
    </section>
  );
}
