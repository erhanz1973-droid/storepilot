/** Source checklist — shown once; never paired with a sentence that repeats the same labels. */
export function SupportedByList({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="exec-supported-by">
      <span className="exec-supported-by-label">Supported by</span>
      <ul className="exec-supported-by-list">
        {sources.map((source) => (
          <li key={source}>
            <span className="exec-supported-by-check" aria-hidden>
              ✓
            </span>
            {source}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EvidenceBulletList({
  points,
  heading = "Evidence",
}: {
  points: string[];
  heading?: string;
}) {
  if (points.length === 0) return null;
  return (
    <div className="exec-evidence-block">
      <span className="exec-evidence-block-label">{heading}</span>
      <ul className="exec-evidence-block-list">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
