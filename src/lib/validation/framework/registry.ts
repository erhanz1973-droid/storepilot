import type { ValidationProviderAdapter } from "./provider";
import type { ValidationProviderId } from "./types";

const adapters = new Map<ValidationProviderId, ValidationProviderAdapter>();

export function registerValidationProvider(adapter: ValidationProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getValidationProvider(
  id: ValidationProviderId,
): ValidationProviderAdapter | undefined {
  return adapters.get(id);
}

export function listValidationProviders(): ValidationProviderAdapter[] {
  return [...adapters.values()];
}

export function requireValidationProvider(id: ValidationProviderId): ValidationProviderAdapter {
  const adapter = adapters.get(id);
  if (!adapter) throw new Error(`Validation provider not registered: ${id}`);
  return adapter;
}
