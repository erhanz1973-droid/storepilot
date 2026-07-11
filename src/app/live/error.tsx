"use client";

import { SegmentError } from "@/components/ui/ErrorFallback";

export default function LiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError error={error} reset={reset} segment="Live mission control" />;
}
