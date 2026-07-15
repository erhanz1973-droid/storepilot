import { FirstRunExperience } from "@/components/first-run/FirstRunExperience";

export const dynamic = "force-dynamic";

export default async function FirstRunPage({
  searchParams,
}: {
  searchParams: Promise<{ installed?: string }>;
}) {
  const params = await searchParams;
  return <FirstRunExperience installed={params.installed === "1"} />;
}
