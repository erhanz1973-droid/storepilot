"use client";

import { useEffect } from "react";

export function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card" style={{ textAlign: "center", padding: 32 }}>
      <h3 style={{ margin: "0 0 8px" }}>Something went wrong</h3>
      <p className="muted">{error.message || "An unexpected error occurred."}</p>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
