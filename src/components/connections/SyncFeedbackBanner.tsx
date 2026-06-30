type Props = {
  kind: "success" | "error";
  message: string;
  detail?: string;
  onDismiss?: () => void;
};

export function SyncFeedbackBanner({ kind, message, detail, onDismiss }: Props) {
  return (
    <div
      className={`sync-feedback-banner sync-feedback-${kind}`}
      role="alert"
      style={{ marginTop: 12 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>{message}</p>
          {detail && (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem", lineHeight: 1.45 }}>
              {detail}
            </p>
          )}
        </div>
        {onDismiss && (
          <button type="button" className="btn btn-ghost" onClick={onDismiss} style={{ padding: "2px 8px" }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
