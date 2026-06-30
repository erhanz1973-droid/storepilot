import type { ActionExecutionLog } from "@/lib/execution/types";

function formatAction(actionType: string) {
  return actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: ActionExecutionLog["status"]) {
  if (status === "ready") return "Ready (Dry Run)";
  if (status === "success") return "Success";
  if (status === "failed") return "Failed";
  return status;
}

export function ExecutionHistoryList({ logs }: { logs: ActionExecutionLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        No executed actions yet. Approve a Meta pause-campaign recommendation to create the first
        audit log.
      </p>
    );
  }

  return (
    <div className="stack">
      {logs.map((log) => (
        <article key={log.id} className="execution-log-card">
          <div className="execution-log-top">
            <span className="muted" style={{ fontSize: "0.82rem" }}>
              {new Date(log.executedAt).toLocaleString()}
            </span>
            <span className={`badge ${log.status === "success" ? "badge-low" : log.status === "failed" ? "badge-critical" : "badge-medium"}`}>
              {formatStatus(log.status)}
            </span>
          </div>
          <div className="execution-log-grid">
            <div>
              <p className="execution-log-label">Campaign</p>
              <strong>{log.entityName}</strong>
            </div>
            <div>
              <p className="execution-log-label">Action</p>
              <strong>{formatAction(log.actionType)}</strong>
            </div>
            <div>
              <p className="execution-log-label">Executed by</p>
              <strong>StorePilot</strong>
            </div>
            <div>
              <p className="execution-log-label">Approved by</p>
              <strong>{log.approvedBy}</strong>
            </div>
            <div>
              <p className="execution-log-label">Mode</p>
              <strong>{log.executionMode === "live" ? "Live" : "Dry Run"}</strong>
            </div>
            {log.durationMs != null && (
              <div>
                <p className="execution-log-label">Duration</p>
                <strong>{log.durationMs} ms</strong>
              </div>
            )}
            <div>
              <p className="execution-log-label">Platform</p>
              <strong>{log.platform.replace(/_/g, " ")}</strong>
            </div>
          </div>
          {log.errorMessage && (
            <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>
              {log.errorMessage}
            </p>
          )}
          {log.status === "ready" && (
            <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>
              Validated API request logged. Enable Live mode to send to Meta.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
