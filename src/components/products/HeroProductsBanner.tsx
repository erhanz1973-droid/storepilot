import type { ProductIntelligenceProfile } from "@/lib/products/types";

export function HeroProductsBanner({ heroes }: { heroes: ProductIntelligenceProfile[] }) {
  if (heroes.length === 0) return null;

  return (
    <div className="hero-products-banner">
      {heroes.map((h) => (
        <div key={h.productId} className="hero-product-chip">
          <span className="hero-star">⭐</span>
          <div>
            <strong>{h.title}</strong>
            <p>{h.heroReason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
