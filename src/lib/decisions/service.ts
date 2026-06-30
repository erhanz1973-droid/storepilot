/**
 * Decision Service — public API for persisted decisions.
 * Backed by the recommendation persistence layer (Phase 2.1).
 */
export {
  RecommendationService as DecisionService,
  recommendationService as decisionService,
} from "@/lib/recommendations/service";

export type {
  RecommendationRecord as DecisionRecord,
  RecommendationEvent as DecisionEvent,
  RecommendationDomainStatus as DecisionStatus,
  CreateRecommendationInput as CreateDecisionInput,
} from "@/lib/recommendations/types";
