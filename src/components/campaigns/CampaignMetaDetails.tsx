import type { CampaignMetaDetailsView } from "@/lib/meta/campaign-details";

type Props = {
  details?: CampaignMetaDetailsView | null;
  compact?: boolean;
};

export function CampaignMetaDetails({ details, compact = false }: Props) {
  if (!details) {
    return <span className="muted">—</span>;
  }

  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Durum", value: details.statusLabel, highlight: details.statusLabel === "Aktif" },
    { label: "Hedef", value: details.objectiveLabel },
    { label: "Günlük bütçe", value: details.dailyBudgetLabel },
    { label: "Süre", value: details.durationLabel },
  ];

  return (
    <div className={`campaign-meta-details${compact ? " campaign-meta-details-compact" : ""}`}>
      {rows.map((row) => (
        <div key={row.label} className="campaign-meta-details-row">
          <span className="campaign-meta-details-label">{row.label}</span>
          <span
            className={`campaign-meta-details-value${
              row.highlight ? " campaign-meta-details-value-active" : ""
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
