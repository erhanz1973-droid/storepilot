"use client";

import { useEffect } from "react";

export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card" style={{ textAlign: "center", padding: 32 }}>
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      <p className="muted">{description ?? error.message ?? "An unexpected error occurred."}</p>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={reset}>
        Try again
      </button>
    </div>
  );
}

export function SegmentError({
  error,
  reset,
  segment,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  segment: string;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title={`${segment} unavailable`}
      description={
        error.message ||
        `We could not load ${segment.toLowerCase()}. Check your connections and try again.`
      }
    />
  );
}
