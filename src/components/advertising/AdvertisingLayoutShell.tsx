"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AdvertisingCopilotPanel } from "./AdvertisingCopilotPanel";

type CopilotContextValue = {
  campaignName?: string;
  setCampaignName: (name?: string) => void;
};

const AdvertisingCopilotContext = createContext<CopilotContextValue | null>(null);

export function useAdvertisingCopilotCampaign() {
  const ctx = useContext(AdvertisingCopilotContext);
  if (!ctx) return { setCampaignName: () => {} };
  return ctx;
}

type Props = {
  children: React.ReactNode;
};

export function AdvertisingLayoutShell({ children }: Props) {
  const [campaignName, setCampaignName] = useState<string | undefined>();
  const value = useMemo(
    () => ({ campaignName, setCampaignName }),
    [campaignName],
  );

  return (
    <AdvertisingCopilotContext.Provider value={value}>
      <div className="adv-layout-with-copilot">
        <div className="adv-layout-main">{children}</div>
        <AdvertisingCopilotPanel campaignName={campaignName} />
      </div>
    </AdvertisingCopilotContext.Provider>
  );
}
