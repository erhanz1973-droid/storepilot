"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiChatMessage } from "@/lib/ai/types";
import { COPILOT_SUGGESTED_PROMPTS } from "@/lib/copilot/types";
import { ChatMessage } from "./ChatMessage";
import { LoadingState } from "@/components/ui/LoadingState";

type AskAiChatProps = {
  prefillQuestion?: string;
  pageContext?: string;
  recommendationTitle?: string;
  recommendationId?: string;
  decisionId?: string;
};

function buildWelcomeMessage(recommendationTitle?: string): AiChatMessage {
  if (recommendationTitle) {
    return {
      id: "welcome",
      role: "assistant",
      content: `I already have context on your recommendation: **${recommendationTitle}**.\n\nAsk why I'm recommending it, what happens if you wait, or whether there's a safer alternative — you don't need to repeat the details.`,
      createdAt: new Date().toISOString(),
    };
  }
  return {
    id: "welcome",
    role: "assistant",
    content:
      "I'm your StorePilot AI Copilot — your daily operations manager. I prioritize what to do next based on your store, ads, and inventory.\n\nAsk me to explain any recommendation, dig into a campaign, or explore what-if scenarios. Every answer includes evidence and confidence.",
    createdAt: new Date().toISOString(),
  };
}

export function AskAiChat({
  prefillQuestion,
  pageContext,
  recommendationTitle,
  recommendationId,
  decisionId,
}: AskAiChatProps = {}) {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => [
    buildWelcomeMessage(recommendationTitle),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const prefillSent = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const chatContext = {
    pageContext,
    recommendationTitle,
    recommendationId,
    decisionId,
  };

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: AiChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId, ...chatContext }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const data = (await res.json()) as {
        message: AiChatMessage;
        sessionId: string;
      };

      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, data.message]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't process that request. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }

  useEffect(() => {
    if (prefillQuestion && !prefillSent.current) {
      prefillSent.current = true;
      void sendMessage(prefillQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-send once on mount
  }, [prefillQuestion]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="ask-ai-layout">
      <div className="ask-ai-chat card">
        <div className="chat-messages">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {loading && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-bubble chat-bubble-loading">
                <LoadingState label="Analyzing your store data…" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="chat-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sales, ROAS, campaigns, opportunities…"
            className="shop-input"
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>

      <aside className="ask-ai-sidebar">
        <div className="card">
          <h3>Suggested questions</h3>
          <div className="suggested-questions">
            {COPILOT_SUGGESTED_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                className="suggested-question-btn"
                onClick={() => sendMessage(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>How I answer</h3>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5, fontSize: "0.875rem" }}>
            I use Integration Health, Store Health, AI Insights, the Opportunity Engine, Priority
            Queue, and Trend Detection — never generic advice. Session memory handles follow-ups
            like &quot;what about last week?&quot; or &quot;compare with Meta.&quot;
          </p>
        </div>
      </aside>
    </div>
  );
}
