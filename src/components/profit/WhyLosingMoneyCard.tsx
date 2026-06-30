import type { WhyLosingMoney } from "@/lib/profit/profit-page-view";

export function WhyLosingMoneyCard({ insight }: { insight: WhyLosingMoney }) {
  return (
    <div className="card profit-why-losing">
      <h3 style={{ margin: "0 0 8px" }}>{insight.title}</h3>
      {insight.paragraphs.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? "0 0 8px" : "0 0 8px", lineHeight: 1.5 }}>
          {p}
        </p>
      ))}
    </div>
  );
}
