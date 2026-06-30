import type { CopilotIntent } from "./types";

export type CopilotSessionMemory = {
  sessionId: string;
  date: string;
  discussedTopics: string[];
  lastIntent?: CopilotIntent;
  lastQuestion?: string;
  recentTurns: { role: "user" | "assistant"; snippet: string; intent?: CopilotIntent }[];
  messageCount: number;
};

const sessions = new Map<string, CopilotSessionMemory>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function sessionKey(sessionId: string): string {
  return `${sessionId}:${todayKey()}`;
}

export function getCopilotSession(sessionId: string): CopilotSessionMemory {
  const key = sessionKey(sessionId);
  const existing = sessions.get(key);
  if (existing) return existing;

  const memory: CopilotSessionMemory = {
    sessionId,
    date: todayKey(),
    discussedTopics: [],
    recentTurns: [],
    messageCount: 0,
  };
  sessions.set(key, memory);
  return memory;
}

export function recordCopilotTurn(
  sessionId: string,
  input: {
    userQuestion: string;
    assistantSummary: string;
    intent: CopilotIntent;
  },
): void {
  const memory = getCopilotSession(sessionId);
  memory.lastIntent = input.intent;
  memory.lastQuestion = input.userQuestion;
  if (!memory.discussedTopics.includes(input.intent)) {
    memory.discussedTopics.push(input.intent);
  }
  memory.messageCount += 1;
  memory.recentTurns.push(
    { role: "user", snippet: input.userQuestion.slice(0, 120), intent: input.intent },
    { role: "assistant", snippet: input.assistantSummary.slice(0, 160), intent: input.intent },
  );
  if (memory.recentTurns.length > 10) {
    memory.recentTurns = memory.recentTurns.slice(-10);
  }
}

export function getSessionContextHint(sessionId: string): string {
  const memory = getCopilotSession(sessionId);
  if (!memory.lastIntent || memory.recentTurns.length < 2) return "";
  return `Prior topic: ${memory.lastIntent}. Last question: "${memory.lastQuestion ?? ""}".`;
}
