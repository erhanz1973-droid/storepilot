export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <p style={{ margin: 0, fontWeight: 500 }}>{title}</p>
      {description && (
        <p className="muted" style={{ marginTop: 8 }}>
          {description}
        </p>
      )}
    </div>
  );
}
