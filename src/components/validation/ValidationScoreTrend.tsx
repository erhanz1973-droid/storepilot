type Props = {
  scores: number[];
  height?: number;
};

export function ValidationScoreTrend({ scores, height = 64 }: Props) {
  if (scores.length === 0) return null;

  const min = Math.min(...scores, 90);
  const max = 100;
  const range = max - min || 1;
  const width = Math.max(scores.length * 28, 120);
  const barWidth = Math.min(24, width / scores.length - 4);

  return (
    <div>
      <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.75rem" }}>
        Validation Score Trend
      </p>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {scores.map((score, i) => {
          const barH = ((score - min) / range) * (height - 20) + 8;
          const x = i * (width / scores.length) + 4;
          const y = height - barH;
          const color = score >= 99.5 ? "#22c55e" : score >= 90 ? "#eab308" : "#ef4444";
          return (
            <g key={`${i}-${score}`}>
              <rect x={x} y={y} width={barWidth} height={barH} fill={color} rx={2} opacity={0.85} />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="9"
                fill="currentColor"
                opacity={0.7}
              >
                {score % 1 === 0 ? score : score.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
