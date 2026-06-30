import type { AnalyzerOutput } from "@/lib/types";
import type {
  CreateRecommendationInput,
  RecommendationDomainStatus,
  RecommendationEvent,
  RecommendationRecord,
} from "./types";
import {
  outputToCreateInput,
  recordToLegacyRecommendation,
} from "./types";
import {
  RecommendationRepository,
  recommendationRepository,
} from "./repository";
import {
  assertValidStatusTransition,
  createRecommendationSchema,
  eventTypeForStatus,
  isTerminalStatus,
} from "./validators";

export class RecommendationService {
  constructor(private readonly repo: RecommendationRepository = recommendationRepository) {}

  async create(input: CreateRecommendationInput): Promise<RecommendationRecord> {
    const parsed = createRecommendationSchema.parse(input) as CreateRecommendationInput;
    const { record, created } = await this.repo.upsert(parsed);
    if (created) {
      await this.repo.appendEvent({
        recommendationId: record.id,
        eventType: "RecommendationCreated",
        payloadJson: {
          dedupeKey: record.dedupeKey,
          recommendationType: record.recommendationType,
          priority: record.priority,
        },
      });
    }
    return record;
  }

  async syncFromAnalyzerOutputs(
    outputs: AnalyzerOutput[],
    storeId: string,
  ): Promise<RecommendationRecord[]> {
    const inputs = outputs.map((output) => outputToCreateInput(output, storeId));
    const results = await this.repo.upsertBatch(inputs);

    for (const { record, created } of results) {
      if (created) {
        await this.repo.appendEvent({
          recommendationId: record.id,
          eventType: "RecommendationCreated",
          payloadJson: {
            dedupeKey: record.dedupeKey,
            source: "analyzer_sync",
          },
        });
      }
    }

    await this.reconcileStale(storeId, new Set(outputs.map((o) => o.id)));
    return this.repo.findByStoreId(storeId);
  }

  async getById(id: string): Promise<RecommendationRecord | null> {
    return this.repo.findById(id);
  }

  async list(storeId: string): Promise<RecommendationRecord[]> {
    return this.repo.findByStoreId(storeId);
  }

  async listAsLegacy(storeId: string) {
    const records = await this.list(storeId);
    return records.map(recordToLegacyRecommendation);
  }

  async recordViewed(id: string, userId?: string): Promise<RecommendationEvent> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error("Recommendation not found");
    return this.repo.appendEvent({
      recommendationId: id,
      eventType: "RecommendationViewed",
      userId,
      payloadJson: { status: record.status },
    });
  }

  async approve(
    id: string,
    options?: { userId?: string; note?: string },
  ): Promise<RecommendationRecord> {
    return this.transitionStatus(id, "approved", options);
  }

  async reject(
    id: string,
    options?: { userId?: string; note?: string },
  ): Promise<RecommendationRecord> {
    return this.transitionStatus(id, "rejected", options);
  }

  async dismiss(
    id: string,
    options?: { userId?: string; note?: string },
  ): Promise<RecommendationRecord> {
    return this.transitionStatus(id, "dismissed", options);
  }

  async reconcileStale(
    storeId: string,
    currentDedupeKeys: Set<string>,
  ): Promise<number> {
    const open = await this.repo.listOpenByStore(storeId);
    let reconciled = 0;

    for (const record of open) {
      if (currentDedupeKeys.has(record.dedupeKey)) continue;
      if (isTerminalStatus(record.status)) continue;
      if (record.status === "approved") continue;

      try {
        await this.transitionStatus(record.id, "expired", {
          note: "No longer detected — condition resolved or no longer applies",
        });
        reconciled += 1;
      } catch (err) {
        console.warn(
          "[StorePilot] Could not expire stale recommendation",
          record.id,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return reconciled;
  }

  async listEvents(recommendationId: string): Promise<RecommendationEvent[]> {
    return this.repo.listEvents(recommendationId);
  }

  private async transitionStatus(
    id: string,
    to: RecommendationDomainStatus,
    options?: { userId?: string; note?: string },
  ): Promise<RecommendationRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new Error("Recommendation not found");

    assertValidStatusTransition(record.status, to);
    const updated = await this.repo.updateStatus(id, to);

    const eventType = eventTypeForStatus(to);
    if (eventType) {
      await this.repo.appendEvent({
        recommendationId: id,
        eventType,
        userId: options?.userId,
        payloadJson: {
          fromStatus: record.status,
          toStatus: to,
          note: options?.note,
        },
      });
    } else if (to === "expired") {
      await this.repo.appendEvent({
        recommendationId: id,
        eventType: "RecommendationDismissed",
        payloadJson: {
          fromStatus: record.status,
          toStatus: to,
          reason: "stale_reconcile",
          note: options?.note,
        },
      });
    }

    return updated;
  }
}

export const recommendationService = new RecommendationService();
