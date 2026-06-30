"use client";

export function ConnectMetaAdsButton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <a href="/api/meta/auth" className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>
        Connect Meta Ads
      </a>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      <p className="muted" style={{ margin: 0 }}>
        Connect your Meta Business account to analyze live campaign ROAS, spend, CTR, and
        frequency from the Marketing API. You will authorize with Facebook, then choose your
        Business Manager and ad account(s).
      </p>
      <a href="/api/meta/auth" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        Connect Meta Ads
      </a>
    </div>
  );
}
