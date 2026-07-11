"use client";

import { useCallback, useRef, useState } from "react";
import type { AiChatMessage } from "@/lib/ai/types";
import { ChatMessage } from "@/components/ask-ai/ChatMessage";
import { LoadingState } from "@/components/ui/LoadingState";

const ADVERTISING_PROMPTS = [
  "Why is Google better?",
  "Which campaign should I pause?",
  "Can I increase Meta budget?",
  "Show worst creatives.",
  "Compare Meta vs Google.",
] as const;

type Props = {
  campaignName?: string;
  pageContext?: string;
};

export function AdvertisingCopilotPanel({ campaignName, pageContext = "advertising" }: Props) {
  const welcome = campaignName
    ? `I'm your Advertising Copilot for **${campaignName}**. Ask why metrics look the way they do, what to pause, or where to shift budget.`
    : "I'm your Advertising Copilot. Ask about campaigns, creatives, budget shifts, or platform performance — I'll answer with actions, not jargon.";

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcome,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          pageContext,
          recommendationTitle: campaignName,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const data = (await res.json()) as { message: AiChatMessage; sessionId: string };
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, data.message]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <aside className="adv-copilot-panel" aria-label="Advertising Copilot">
      <div className="adv-copilot-header">
        <h3>Advertising Copilot</h3>
        <span className="muted" style={{ fontSize: "0.75rem" }}>Always on</span>
      </div>

      <div className="adv-copilot-prompts">
        {ADVERTISING_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            className="adv-copilot-prompt-btn"
            onClick={() => void sendMessage(q)}
            disabled={loading}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="adv-copilot-messages">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onFollowUp={(q) => void sendMessage(q)}
          />
        ))}
        {loading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-bubble chat-bubble-loading">
              <LoadingState label="Analyzing advertising data…" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="adv-copilot-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI…"
          className="shop-input"
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
