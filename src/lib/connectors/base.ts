import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import type { StoreSnapshot } from "./types";

export type ConnectorHealthResult = {
  status: ConnectorStatus;
  lastSyncAt?: string;
  errorMessage?: string;
};

export type ConnectorPlugin = {
  id: DataSourceId;
  label: string;
  connect(): Promise<void>;
  sync(): Promise<Partial<StoreSnapshot>>;
  healthCheck(): Promise<ConnectorHealthResult>;
  disconnect(): Promise<void>;
  /** Legacy adapter for existing registry */
  getStatus(): Promise<ConnectorHealthResult & { id: DataSourceId; label: string }>;
  fetchStoreSnapshot(): Promise<Partial<StoreSnapshot>>;
};

export type ConnectorRegistry = Record<DataSourceId, ConnectorPlugin>;
