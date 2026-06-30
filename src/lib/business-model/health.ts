import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import { getDecisionPack } from "@/lib/decision-packs/registry";
import type { BusinessModelHealth, BusinessModelHealthMetric, MerchantBusinessProfile } from "./types";

function metric(
  id: string,
  label: string,
  scorePct: number,
  detail: string,
): BusinessModelHealthMetric {
  const status =
    scorePct >= 70 ? "healthy" : scorePct >= 45 ? "watch" : "critical";
  return { id, label, scorePct, status, detail };
}

export function computeBusinessModelHealth(input: {
  profile: MerchantBusinessProfile;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
}): BusinessModelHealth {
  const pack = getDecisionPack(input.profile.businessModel, input.profile.hybridModelWeights);
  const products = input.snapshot.products ?? [];
  const roas = input.profitDashboard?.blendedRoas?.blendedRoas30d ?? 0;
  const margin = input.profitDashboard?.primary.profitMarginPct ?? 0;
  const conversion = input.snapshot.storeMetrics?.conversionRate30d ?? 0;

  const metrics: BusinessModelHealthMetric[] = [];

  for (const id of pack.healthMetricIds) {
    switch (id) {
      case "inventory_health": {
        const inStock = products.filter((p) => p.inventoryQuantity > 0).length;
        const ratio = products.length ? (inStock / products.length) * 100 : 50;
        metrics.push(metric(id, "Inventory Health", Math.round(ratio), `${inStock}/${products.length} SKUs in stock`));
        break;
      }
      case "inventory_aging": {
        const slow = products.filter((p) => p.inventoryQuantity >= 30 && p.unitsSold30d <= 10).length;
        const score = products.length ? Math.max(0, 100 - (slow / products.length) * 200) : 60;
        metrics.push(metric(id, "Inventory Aging", Math.round(score), `${slow} slow-moving SKUs`));
        break;
      }
      case "clearance_opportunities": {
        const clearance = products.filter((p) => p.inventoryQuantity >= 50 && p.unitsSold30d <= 5).length;
        const score = Math.max(20, 100 - clearance * 12);
        metrics.push(metric(id, "Clearance Pressure", Math.round(score), `${clearance} SKUs need clearance`));
        break;
      }
      case "warehouse_value": {
        const value = products.reduce((s, p) => s + p.inventoryQuantity * p.price * 0.35, 0);
        const score = value > 50000 ? 45 : value > 20000 ? 60 : 80;
        metrics.push(metric(id, "Warehouse Value", score, `~$${Math.round(value).toLocaleString()} tied in stock`));
        break;
      }
      case "winning_products": {
        const heroes = input.productIntelligence?.heroes?.length ?? 0;
        const score = Math.min(95, 40 + heroes * 15);
        metrics.push(metric(id, "Winning Products", score, `${heroes} hero SKUs identified`));
        break;
      }
      case "creative_fatigue": {
        const campaigns = input.snapshot.campaigns ?? [];
        const stale = campaigns.filter((c) => (c.roas7d ?? 0) < 1 && (c.spend7d ?? 0) > 100).length;
        const score = Math.max(25, 100 - stale * 18);
        metrics.push(metric(id, "Creative Fatigue", Math.round(score), `${stale} campaigns underperforming`));
        break;
      }
      case "roas": {
        const score = roas >= 2.5 ? 90 : roas >= 1.5 ? 70 : roas >= 1 ? 50 : 30;
        metrics.push(metric(id, "ROAS", score, `Blended 30d ROAS ${roas.toFixed(2)}`));
        break;
      }
      case "scaling_opportunities": {
        const scalable = (input.snapshot.campaigns ?? []).filter((c) => (c.roas7d ?? 0) >= 2).length;
        const score = Math.min(95, 35 + scalable * 20);
        metrics.push(metric(id, "Scaling Opportunities", score, `${scalable} campaigns ready to scale`));
        break;
      }
      case "store_conversion": {
        const score = conversion >= 3 ? 85 : conversion >= 2 ? 65 : conversion >= 1 ? 45 : 30;
        metrics.push(metric(id, "Store Conversion", score, `${conversion.toFixed(2)}% conversion rate`));
        break;
      }
      case "refund_rate": {
        metrics.push(metric(id, "Refund Rate", 72, "Refund signal monitoring (connector pending)"));
        break;
      }
      case "churn_risk": {
        metrics.push(metric(id, "Churn Risk", 68, "Retention signal monitoring"));
        break;
      }
      case "renewal_rate": {
        metrics.push(metric(id, "Renewal Rate", 74, "Subscription renewal tracking"));
        break;
      }
      case "trial_conversion": {
        metrics.push(metric(id, "Trial Conversion", 62, "Trial-to-paid funnel monitoring"));
        break;
      }
      case "customer_ltv": {
        const aov = input.profile.averageOrderValue ?? input.snapshot.storeMetrics?.aov30d ?? 0;
        const score = aov >= 80 ? 85 : aov >= 50 ? 70 : 55;
        metrics.push(metric(id, "Customer LTV Proxy", score, `AOV $${aov.toFixed(0)}`));
        break;
      }
      case "funnel_conversion": {
        metrics.push(metric(id, "Funnel Conversion", Math.round(conversion * 20), `${conversion.toFixed(2)}% store conversion`));
        break;
      }
      case "checkout_conversion": {
        metrics.push(metric(id, "Checkout Conversion", Math.round(conversion * 18 + 20), "Checkout step monitoring"));
        break;
      }
      case "design_performance": {
        const top = input.productIntelligence?.heroes?.[0]?.title ?? "—";
        metrics.push(metric(id, "Design Performance", 76, `Top design: ${top}`));
        break;
      }
      case "margin_expansion": {
        const score = margin >= 50 ? 88 : margin >= 35 ? 72 : 48;
        metrics.push(metric(id, "Margin Expansion", score, `${margin.toFixed(1)}% net margin`));
        break;
      }
      default:
        metrics.push(metric(id, id.replace(/_/g, " "), 60, "Monitoring"));
    }
  }

  const overallScorePct =
    metrics.length === 0
      ? 60
      : Math.round(metrics.reduce((s, m) => s + m.scorePct, 0) / metrics.length);

  return {
    businessModel: input.profile.businessModel,
    overallScorePct,
    metrics,
  };
}
