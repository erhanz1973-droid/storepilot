import Link from "next/link";
import type { ExecutiveModuleId } from "@/lib/analytics/executive-modules";
import { EXECUTIVE_MODULES } from "@/lib/analytics/executive-modules";

export function CrossModuleReference({
  message,
  targetModule,
  linkLabel,
}: {
  message: string;
  targetModule: ExecutiveModuleId;
  linkLabel?: string;
}) {
  const meta = EXECUTIVE_MODULES[targetModule];
  return (
    <div className="cross-module-ref">
      <p className="cross-module-message">{message}</p>
      <Link href={meta.href} className="btn btn-secondary btn-sm">
        {linkLabel ?? `${meta.label} →`}
      </Link>
    </div>
  );
}
