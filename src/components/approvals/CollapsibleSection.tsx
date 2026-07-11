"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`decision-collapsible ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="decision-collapsible-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h5>{title}</h5>
          {!open && summary && <span className="decision-collapsible-summary muted">{summary}</span>}
        </div>
        <span className="decision-collapsible-chevron">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="decision-collapsible-body">{children}</div>}
    </section>
  );
}
