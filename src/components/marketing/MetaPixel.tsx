import { getMetaPixelId } from "@/lib/marketing/pixel";

/**
 * Meta Pixel on the public marketing site only — never inside Shopify Admin.
 * Renders nothing when NEXT_PUBLIC_META_PIXEL_ID is unset or invalid.
 */
export function MetaPixel() {
  const pixelId = getMetaPixelId();
  if (!pixelId) return null;

  const snippet = `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
`.trim();

  return (
    <>
      <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: snippet }} />
      <noscript>
        <img
          height={1}
          width={1}
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
