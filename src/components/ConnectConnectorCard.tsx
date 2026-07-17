import Link from "next/link";
import type { ConnectorCapability } from "@/lib/connectors/capabilities";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

type Props = {
  connector: ConnectorCapability;
};

export function ConnectConnectorCard({ connector }: Props) {
  const href = connector.connectHref ?? "/connected-store";
  const isOAuthRoute = href.startsWith("/api/");

  const connectButton = isOAuthRoute ? (
    <TopLevelOAuthLink href={href} className="btn btn-primary" style={{ flexShrink: 0 }}>
      Connect
    </TopLevelOAuthLink>
  ) : (
    <Link href={href} className="btn btn-primary" style={{ flexShrink: 0 }}>
      Connect
    </Link>
  );

  return (
    <div className="card connect-connector-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: "0 0 8px" }}>Connect {connector.label}</h3>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {connector.description}. AI recommendations for this source are disabled until you
            connect.
          </p>
        </div>
        {connectButton}
      </div>
    </div>
  );
}

export function ConnectConnectorGrid({ connectors }: { connectors: ConnectorCapability[] }) {
  if (connectors.length === 0) return null;

  return (
    <div className="stack" style={{ marginBottom: 16 }}>
      {connectors.map((connector) => (
        <ConnectConnectorCard key={connector.id} connector={connector} />
      ))}
    </div>
  );
}
