"use client";

type Props = {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
};

export function AnalyticsTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="analytics-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`analytics-tab ${active === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
