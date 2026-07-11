import type { ExecutiveKpi } from "@/lib/analytics/executive-advisor";

function toneClass(tone: ExecutiveKpi["tone"]): string {
  if (tone === "positive") return "positive";
  if (tone === "negative") return "negative";
  if (tone === "warning") return "exec-kpi-warning";
  if (tone === "muted") return "muted";
  return "";
}

export function ExecutiveKpiRow({ kpis }: { kpis: ExecutiveKpi[] }) {
  if (kpis.length === 0) return null;

  return (
    <section className="exec-advisor-kpi-row card" aria-label="Executive KPIs">
      <ul className="exec-advisor-kpi-list">
        {kpis.map((kpi) => (
          <li key={kpi.id} className="exec-advisor-kpi-item">
            <span className="exec-advisor-kpi-label muted">{kpi.label}</span>
            <strong className={`exec-advisor-kpi-value ${toneClass(kpi.tone)}`}>{kpi.value}</strong>
            {kpi.sublabel && (
              <span className="exec-advisor-kpi-sublabel muted">{kpi.sublabel}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
