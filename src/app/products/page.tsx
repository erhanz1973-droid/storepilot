import { redirect } from "next/navigation";

export default function LegacyProductsRedirect() {
  redirect("/analytics/products");
}
