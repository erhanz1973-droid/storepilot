import { describe, expect, it } from "vitest";
import { fingerprintData, getOrCompute, invalidateComputeCache } from "../compute-cache";

describe("compute-cache", () => {
  it("reuses value when fingerprint is unchanged", () => {
    invalidateComputeCache();
    let runs = 0;
    const compute = () => {
      runs += 1;
      return { score: 42 };
    };

    const fp = fingerprintData({ revenue: 1000, spend: 200 });
    const a = getOrCompute("test-key", fp, 60_000, compute);
    const b = getOrCompute("test-key", fp, 60_000, compute);

    expect(a).toEqual(b);
    expect(runs).toBe(1);
  });

  it("recomputes when fingerprint changes", () => {
    invalidateComputeCache();
    let runs = 0;
    const compute = () => {
      runs += 1;
      return runs;
    };

    getOrCompute("test-key-2", fingerprintData({ a: 1 }), 60_000, compute);
    const second = getOrCompute("test-key-2", fingerprintData({ a: 2 }), 60_000, compute);

    expect(second).toBe(2);
    expect(runs).toBe(2);
  });
});
