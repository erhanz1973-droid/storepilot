import Link from "next/link";
import {
  EXECUTIVE_MODULES,
  EXECUTIVE_STORY_FLOW,
  type ExecutiveModuleId,
} from "@/lib/analytics/executive-modules";

export function ExecutiveStoryNav({ current }: { current: ExecutiveModuleId }) {
  const index = EXECUTIVE_STORY_FLOW.indexOf(current);
  const nextId = index >= 0 ? EXECUTIVE_STORY_FLOW[index + 1] : undefined;
  const prevId = index > 0 ? EXECUTIVE_STORY_FLOW[index - 1] : undefined;

  if (!nextId && !prevId) return null;

  return (
    <nav className="exec-story-nav card" aria-label="Executive story flow">
      <span className="muted exec-story-nav-label">Executive operating system</span>
      <div className="exec-story-nav-links">
        {prevId && (
          <Link href={EXECUTIVE_MODULES[prevId].href} className="btn btn-ghost btn-sm">
            ← {EXECUTIVE_MODULES[prevId].role}
          </Link>
        )}
        {nextId && (
          <Link href={EXECUTIVE_MODULES[nextId].href} className="btn btn-secondary btn-sm">
            Next: {EXECUTIVE_MODULES[nextId].role} — {EXECUTIVE_MODULES[nextId].label} →
          </Link>
        )}
      </div>
    </nav>
  );
}
