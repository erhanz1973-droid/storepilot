/** Validation / debug tooling is development-only unless explicitly enabled. */
export function isDevValidationEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.STOREPILOT_VALIDATION_MODE === "1";
  }
  return process.env.STOREPILOT_VALIDATION_MODE !== "0";
}

/** Audit, export, regression — hidden from customer-facing Simulation Lab demos. */
export function isDeveloperToolsEnabled(): boolean {
  if (process.env.STOREPILOT_DEVELOPER_MODE === "0") return false;
  if (process.env.STOREPILOT_DEVELOPER_MODE === "1") return true;
  return process.env.NODE_ENV === "development";
}
