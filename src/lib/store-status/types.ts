import type { ConnectorStatus } from "@/lib/types";

export type StoreAnalyzedCounts = {
  products: number;
  campaigns: number;
  orders: number;
  customers: number;
  collections: number;
};

export type StoreIntegrationStatus = {
  label: string;
  status: ConnectorStatus;
  connected: boolean;
};

export type StoreUnavailableReason = {
  id: string;
  message: string;
};

export type StoreStatus = {
  lastSyncedAt: string;
  integrations: StoreIntegrationStatus[];
  analyzed: StoreAnalyzedCounts;
  unavailableReasons: StoreUnavailableReason[];
  reassuranceMessage: string;
  headline: string;
};
