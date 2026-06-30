import { redirect } from "next/navigation";

export default function LegacyRoasRedirect() {
  redirect("/analytics/marketing");
}
