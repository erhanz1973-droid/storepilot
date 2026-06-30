import type { SimulationScenarioNarrative } from "@/lib/simulation-stores/scenario-narratives";

type Props = {
  narrative: SimulationScenarioNarrative;
  compact?: boolean;
};

export function SimulationScenarioBrief({ narrative, compact = false }: Props) {
  if (compact) {
    return (
      <div className="sim-scenario-brief sim-scenario-brief-compact">
        <p className="sim-scenario-brief-eyebrow">Scenario</p>
        <p className="sim-scenario-brief-lead">{narrative.paragraphs[0]}</p>
        <p className="muted sim-scenario-brief-purpose">
          <strong>Purpose:</strong> {narrative.purpose}
        </p>
      </div>
    );
  }

  return (
    <section className="sim-scenario-brief">
      <p className="sim-scenario-brief-eyebrow">Scenario</p>
      <h4 className="sim-scenario-brief-title">{narrative.title}</h4>
      <div className="sim-scenario-brief-body">
        {narrative.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="sim-scenario-brief-meta">
        <p>
          <strong>Purpose:</strong> {narrative.purpose}
        </p>
        <p>
          <strong>AI should recommend:</strong> {narrative.aiShouldRecommend}
        </p>
      </div>
    </section>
  );
}
