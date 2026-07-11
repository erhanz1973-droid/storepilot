import { describe, expect, it } from "vitest";
import { computeRoas, formatRoas, roundRoas } from "@/lib/attribution/format-roas";

describe("format-roas", () => {
  it("computes ROAS as revenue divided by spend", () => {
    expect(computeRoas(1808, 34800)).toBeCloseTo(0.052, 3);
    expect(computeRoas(0, 1000)).toBe(0);
    expect(computeRoas(500, 0)).toBeNull();
  });

  it("never formats non-zero ROAS as 0.00", () => {
    const roas = computeRoas(1808, 34800)!;
    expect(formatRoas(roas)).toBe("0.05");
    expect(formatRoas(0.08)).toBe("0.08");
    expect(formatRoas(1.42)).toBe("1.42");
    expect(formatRoas(12.5)).toBe("12.5");
  });

  it("preserves precision for small ROAS values", () => {
    expect(roundRoas(0.05195)).toBe(0.052);
    expect(roundRoas(2.34)).toBe(2.34);
  });
});
