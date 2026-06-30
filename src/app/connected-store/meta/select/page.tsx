import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy path — redirect to Connections flow. */
export default async function LegacyMetaSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  const query = params.session ? `?session=${params.session}` : "";
  redirect(`/connections/meta/select${query}`);
}
