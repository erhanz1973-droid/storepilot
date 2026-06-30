import { MetaAccountSelector } from "@/components/MetaAccountSelector";
import Link from "next/link";
import { isMetaOAuthConfigured } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

export default async function MetaAccountSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session;

  if (!isMetaOAuthConfigured()) {
    return (
      <>
        <div className="page-header">
          <h2>Meta Ads — hesap seçimi</h2>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Meta OAuth yapılandırılmamış. META_APP_ID, META_APP_SECRET ve META_APP_URL ortam
            değişkenlerini ayarlayın.
          </p>
        </div>
      </>
    );
  }

  if (!sessionId) {
    return (
      <>
        <div className="page-header">
          <h2>Meta Ads — hesap seçimi</h2>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Oturum bulunamadı.{" "}
            <Link href="/api/meta/auth">Meta bağlantısını yeniden başlatın</Link> veya{" "}
            <Link href="/connections?tab=advertising">Connections</Link> sayfasına dönün.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Meta Business &amp; Ad Account seçimi</h2>
        <p>
          Erişebildiğiniz tüm Business Manager ve reklam hesapları listelenir. StorePilot yalnızca
          seçtiğiniz <strong>tek</strong> ad account için kampanya ve insights verisi çeker.
        </p>
      </div>

      <div className="card meta-account-select-card">
        <MetaAccountSelector sessionId={sessionId} />
      </div>
    </>
  );
}
