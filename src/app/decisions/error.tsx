"use client";

import { SegmentError } from "@/components/ui/ErrorFallback";

export default function DecisionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError error={error} reset={reset} segment="Decisions" />;
}
