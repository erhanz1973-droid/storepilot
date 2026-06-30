type Props = {
  variant?: "page" | "inline" | "compact";
  subtitle?: boolean;
};

export function SimulationBadge({ variant = "inline", subtitle = true }: Props) {
  return (
    <div className={`sim-badge sim-badge-${variant}`} role="status" aria-label="Simulated data">
      <span className="sim-badge-label">SIMULATED DATA</span>
      {subtitle ? <span className="sim-badge-sub">AI Training Scenario</span> : null}
    </div>
  );
}
