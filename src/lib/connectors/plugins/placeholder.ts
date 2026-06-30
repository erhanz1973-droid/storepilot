import type { ConnectorPlugin } from "../base";

export function createPlaceholderPlugin(
  id: ConnectorPlugin["id"],
  label: string,
): ConnectorPlugin {
  return {
    id,
    label,
    async connect() {
      /* placeholder — not available in MVP */
    },
    async sync() {
      return {};
    },
    async healthCheck() {
      return { status: "disconnected" };
    },
    async disconnect() {},
    async getStatus() {
      return { id, label, status: "disconnected" };
    },
    async fetchStoreSnapshot() {
      return {};
    },
  };
}
