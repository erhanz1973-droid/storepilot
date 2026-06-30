import { isProductionRuntime } from "@/lib/env/runtime";
import { createHash } from "crypto";

const DEV_FALLBACK = "storepilot-dev-key";

/**
 * Resolve AES-256-GCM key from env. Production requires the named secret ≥32 chars.
 */
export function resolveEncryptionKey(envVar: string, fallbackEnvVars: string[] = []): Buffer {
  const candidates = [envVar, ...fallbackEnvVars];
  for (const key of candidates) {
    const raw = process.env[key]?.trim();
    if (raw && raw.length >= 32) {
      return createHash("sha256").update(raw).digest();
    }
  }

  if (isProductionRuntime()) {
    throw new Error(
      `${envVar} must be set in production (≥32 characters).`,
    );
  }

  return createHash("sha256").update(DEV_FALLBACK).digest();
}
