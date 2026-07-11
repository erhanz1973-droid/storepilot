import { AdvertisingLayoutShell } from "@/components/advertising/AdvertisingLayoutShell";

export default function AdvertisingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdvertisingLayoutShell>{children}</AdvertisingLayoutShell>;
}
