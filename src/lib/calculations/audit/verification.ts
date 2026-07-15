/**
 * Verification Mode — when enabled, calculations log inputs/outputs and surface assumptions.
 * Enable via STOREPILOT_VERIFICATION_MODE=1 or window/local flag in browser tools.
 */

let verificationOverride: boolean | null = null;

export function setVerificationMode(enabled: boolean | null): void {
  verificationOverride = enabled;
}

export function isVerificationMode(): boolean {
  if (verificationOverride != null) return verificationOverride;
  if (typeof process !== "undefined" && process.env?.STOREPILOT_VERIFICATION_MODE === "1") {
    return true;
  }
  return false;
}

export type VerificationLogEntry = {
  decisionId: string;
  formulaVersion: string;
  warnings: string[];
  impact: { businessRecovery: number; netProfitImpact: number };
  at: string;
};

const buffer: VerificationLogEntry[] = [];

export function verificationLog(
  entry: Omit<VerificationLogEntry, "at">,
): void {
  if (!isVerificationMode()) return;
  const row: VerificationLogEntry = { ...entry, at: new Date().toISOString() };
  buffer.push(row);
  if (buffer.length > 200) buffer.shift();
  // eslint-disable-next-line no-console
  console.info("[StorePilot Verification]", JSON.stringify(row));
}

export function getVerificationLog(): readonly VerificationLogEntry[] {
  return buffer;
}

export function clearVerificationLog(): void {
  buffer.length = 0;
}
