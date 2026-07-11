"use client";

const SECTIONS = [
  { id: "account", label: "Account Scan" },
  { id: "priority", label: "Today's Priority" },
  { id: "briefing", label: "Since Last Visit" },
  { id: "overview", label: "AI Summary" },
  { id: "accountability", label: "Accountability" },
  { id: "learning", label: "Learning" },
  { id: "predictions", label: "Predictions" },
  { id: "optimization", label: "AI Actions" },
  { id: "health", label: "Health" },
  { id: "focus", label: "Winners & Losers" },
  { id: "platforms", label: "Platforms" },
  { id: "campaigns", label: "All Campaigns" },
  { id: "creatives", label: "Creatives" },
  { id: "audiences", label: "Audiences" },
  { id: "budget", label: "Budget" },
] as const;

export function AdvertisingSectionNav() {
  return (
    <nav className="adv-section-nav card" aria-label="Advertising workspace sections">
      <span className="muted adv-section-nav-label">Jump to</span>
      <div className="adv-section-nav-links">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="adv-section-nav-link">
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
