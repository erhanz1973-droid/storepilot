/** ROAS = revenue / spend — never round non-zero values to zero. */
export function computeRoas(revenue: number, spend: number): number | null {
  if (spend <= 0) return null;
  if (revenue <= 0) return 0;
  return revenue / spend;
}

export function formatRoas(roas: number | null | undefined): string {
  if (roas == null) return "—";
  if (roas === 0) return "0.00";
  if (roas < 0.1) return roas.toFixed(2);
  if (roas < 10) return roas.toFixed(2);
  return roas.toFixed(1);
}

/** Store numeric ROAS with enough precision for downstream math. */
export function roundRoas(roas: number): number {
  if (roas < 0.1) return Math.round(roas * 1000) / 1000;
  return Math.round(roas * 100) / 100;
}
