"use client";

import { SegmentError } from "@/components/ui/ErrorFallback";

export default function AdvertisingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <SegmentError error={error} reset={reset} segment="Advertising workspace" />;
}
