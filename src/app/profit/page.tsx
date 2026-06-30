import { redirect } from "next/navigation";

export default function LegacyProfitRedirect() {
  redirect("/analytics/profit");
}
