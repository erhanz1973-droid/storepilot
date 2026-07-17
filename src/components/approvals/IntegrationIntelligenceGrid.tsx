import Link from "next/link";
import type { ConnectorCapability } from "@/lib/connectors/capabilities";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

function ConnectButton({ connector }: { connector: ConnectorCapability }) {
  const href = connector.connectHref ?? "/connected-store";
  const isOAuthRoute = href.startsWith("/api/");

  if (isOAuthRoute) {
    return (
      <TopLevelOAuthLink href={href} className="btn btn-primary btn-sm">
        Connect
      </TopLevelOAuthLink>
    );
  }

  return (
    <Link href={href} className="btn btn-primary btn-sm">
      Connect
    </Link>
  );
}

export function IntegrationIntelligenceCard({ connector }: { connector: ConnectorCapability }) {
  const unlocks =
    connector.intelligenceUnlocks ??
    connector.analyzers.map((a) => `${a} analysis`);

  return (
    <div className="card integration-intelligence-card">
      <div className="integration-intelligence-header">
        <div>
          <h3 style={{ margin: "0 0 6px" }}>{connector.label}</h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            Unlock additional AI intelligence by connecting this source.
          </p>
        </div>
        <ConnectButton connector={connector} />
      </div>
      <ul className="integration-intelligence-list">
        {unlocks.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function IntegrationIntelligenceGrid({ connectors }: { connectors: ConnectorCapability[] }) {
  if (connectors.length === 0) return null;

  return (
    <section className="integration-intelligence-grid">
      <h3 className="integration-intelligence-title">Connected Integrations</h3>
      <p className="muted integration-intelligence-sub">
        Each integration unlocks specific AI capabilities for your decision center.
      </p>
      <div className="stack">
        {connectors.map((connector) => (
          <IntegrationIntelligenceCard key={connector.id} connector={connector} />
        ))}
      </div>
    </section>
  );
}
