"use client";

import Link from "next/link";
import { useState } from "react";

const DEFAULT_QUESTIONS = [
  "Why are you recommending this?",
  "What happens if I wait one week?",
  "Show supporting data",
  "Is there a safer alternative?",
  "Can AI perform this automatically?",
];

type Props = {
  title: string;
  context?: string;
  questions?: string[];
  compact?: boolean;
  recommendationId?: string;
  decisionId?: string;
};

export function ExecutiveAskAiPanel({
  title,
  context = "executive",
  questions = DEFAULT_QUESTIONS,
  compact = false,
  recommendationId,
  decisionId,
}: Props) {
  const [open, setOpen] = useState(false);

  function askHref(question: string) {
    const params = new URLSearchParams({
      q: `${question} — ${title}`,
      ctx: context,
      rec: title,
    });
    if (recommendationId) params.set("recommendationId", recommendationId);
    if (decisionId) params.set("decisionId", decisionId);
    return `/ask-ai?${params.toString()}`;
  }

  return (
    <div className={`exec-advisor-ask-ai ${compact ? "compact" : ""}`}>
      <button
        type="button"
        className="exec-advisor-ask-ai-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        ✨ Ask AI about this recommendation
      </button>
      {open && (
        <div className="exec-advisor-ask-ai-panel">
          <p className="muted exec-advisor-ask-ai-context">
            AI uses your executive dashboard and &ldquo;{title}&rdquo; as context.
          </p>
          <div className="exec-advisor-ask-ai-questions">
            {questions.map((q) => (
              <Link
                key={q}
                href={askHref(q)}
                className="exec-advisor-ask-ai-link"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
