import { redirect } from "next/navigation";

export default function LegacyAttributionRedirect() {
  redirect("/analytics/attribution");
}
