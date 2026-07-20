import { LandingPage } from "@/components/marketing/LandingPage";
import { isMarketingRequest } from "@/lib/marketing/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await isMarketingRequest()) {
    return <LandingPage />;
  }

  const ExecutivePage = (await import("./analytics/executive/page")).default;
  return <ExecutivePage />;
}
