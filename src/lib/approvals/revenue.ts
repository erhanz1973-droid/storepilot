export function parseRevenueImpact(expectedImpact: string): number {
  const matches = [...expectedImpact.matchAll(/\$[\d,]+(?:\.\d+)?/g)];
  if (matches.length === 0) return 0;

  const values = matches.map((m) => Number(m[0].replace(/[$,]/g, "")));
  const primary = Math.max(...values);
  const lower = expectedImpact.toLowerCase();

  if (lower.includes("/week") || lower.includes("per week") || lower.includes("weekly")) {
    return Math.round(primary * 4.33);
  }
  if (lower.includes("/day") || lower.includes("per day")) {
    return Math.round(primary * 30);
  }
  return primary;
}
