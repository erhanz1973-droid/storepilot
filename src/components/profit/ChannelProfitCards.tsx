import {
  ChannelProfitabilitySection,
} from "@/components/profit/ChannelProfitabilityDecisionCard";
import type { ChannelProfitabilityCard } from "@/lib/analytics/channel-profitability-card";

/** @deprecated Use ChannelProfitabilitySection — kept for profit page import path. */
export function ChannelProfitCards({ cards }: { cards: ChannelProfitabilityCard[] }) {
  return <ChannelProfitabilitySection cards={cards} />;
}
