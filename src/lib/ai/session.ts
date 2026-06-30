import type { SessionMemory } from "./types";

const sessions = new Map<string, SessionMemory>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getOrCreateSession(sessionId: string): SessionMemory {
  const date = todayKey();
  const key = `${sessionId}:${date}`;
  const existing = sessions.get(key);

  if (existing) return existing;

  const memory: SessionMemory = {
    sessionId,
    date,
    discussedTopics: [],
    explainedRecommendationIds: [],
    messageCount: 0,
  };
  sessions.set(key, memory);
  return memory;
}

export function recordTopic(sessionId: string, topic: string): void {
  const memory = getOrCreateSession(sessionId);
  if (!memory.discussedTopics.includes(topic)) {
    memory.discussedTopics.push(topic);
  }
  memory.messageCount += 1;
}

export function recordExplanation(sessionId: string, recommendationId: string): void {
  const memory = getOrCreateSession(sessionId);
  if (!memory.explainedRecommendationIds.includes(recommendationId)) {
    memory.explainedRecommendationIds.push(recommendationId);
  }
}

export function hasDiscussedTopic(sessionId: string, topic: string): boolean {
  return getOrCreateSession(sessionId).discussedTopics.includes(topic);
}

export function wasExplained(sessionId: string, recommendationId: string): boolean {
  return getOrCreateSession(sessionId).explainedRecommendationIds.includes(recommendationId);
}

export function getSessionSummary(sessionId: string): string {
  const memory = getOrCreateSession(sessionId);
  if (memory.discussedTopics.length === 0) return "";
  return `Already discussed today: ${memory.discussedTopics.join(", ")}. Avoid repeating full explanations for these topics.`;
}
