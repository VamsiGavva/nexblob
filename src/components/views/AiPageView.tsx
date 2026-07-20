"use client";
import { useState, useRef, useEffect } from "react";
import type { ParseResult } from "@/lib/types";

interface AiPageViewProps {
  content: string;
  parsed: ParseResult;
  aiChatHistory?: string;
  onUpdateAiChat?: (history: string) => void;
  activeTable?: string | null;
  activeConnectionId?: string | null;
}

interface Message {
  role: "user" | "model";
  content: string;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      margin: "12px 0",
      borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
      background: "#1e1e2e",
      overflow: "hidden"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(255, 255, 255, 0.05)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
      }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "rgba(205, 214, 244, 0.6)", textTransform: "uppercase" }}>
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: "transparent",
            border: "none",
            color: copied ? "var(--success)" : "rgba(205, 214, 244, 0.6)",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        padding: 12,
        margin: 0,
        overflowX: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: "#cdd6f4",
        lineHeight: 1.5,
        whiteSpace: "pre"
      }}>
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function renderMessageContent(text: string) {
  // Simple markdown parser to separate code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const lang = match?.[1] || "";
      const code = match?.[2] || part.slice(3, -3);
      return <CodeBlock key={i} lang={lang} code={code} />;
    }
    
    // Parse inline code blocks
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((subPart, j) => {
          if (subPart.startsWith("`") && subPart.endsWith("`")) {
            return (
              <code key={j} style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                background: "rgba(108, 92, 231, 0.15)",
                color: "var(--accent-ink)",
                padding: "2px 5px",
                borderRadius: 4
              }}>
                {subPart.slice(1, -1)}
              </code>
            );
          }
          return subPart;
        })}
      </span>
    );
  });
}

export function AiPageView({
  content,
  aiChatHistory,
  onUpdateAiChat,
  activeTable,
  activeConnectionId,
}: AiPageViewProps) {
  const defaultMessage: Message = {
    role: "model",
    content: "Hello! I am your AI query and aggregation expert. I have full context of the active JSON document on the left. Ask me to write a query, database aggregation (SQL, MongoDB pipeline, JS mapping), or filters based on the JSON!"
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync messages with saved chat history prop
  useEffect(() => {
    if (aiChatHistory) {
      try {
        const parsedHistory = JSON.parse(aiChatHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setMessages(parsedHistory);
          return;
        }
      } catch {}
    }
    setMessages([defaultMessage]);
  }, [aiChatHistory]);

  const scroll = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scroll();
  }, [messages, loading]);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMessage];
    
    // Update local state and parent state immediately
    setMessages(updatedMessages);
    onUpdateAiChat?.(JSON.stringify(updatedMessages));
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          content, // Sends the active editor's JSON text
          messages: updatedMessages,
          activeTable,
          activeConnectionId: activeConnectionId ? String(activeConnectionId) : null,
        })
      });

      const data = await res.json() as { result?: string; error?: string };
      if (data.error) throw new Error(data.error);

      const replyMessage: Message = { role: "model", content: data.result ?? "No response received." };
      const finalMessages = [...updatedMessages, replyMessage];
      
      setMessages(finalMessages);
      onUpdateAiChat?.(JSON.stringify(finalMessages));
    } catch (e) {
      const errorMessage: Message = { role: "model", content: `Error: ${(e as Error).message}` };
      const finalMessages = [...updatedMessages, errorMessage];
      
      setMessages(finalMessages);
      onUpdateAiChat?.(JSON.stringify(finalMessages));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };


  const suggestions = [
    "Write SQL query to find elements with highest values",
    "Create MongoDB aggregation pipeline to group & count",
    "Write JS map/filter logic to extract unique records",
    "Explain schema and write a SQLite search query"
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg)" }}>
      {/* Chat Header */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>✦ AI Query & Aggregation Specialist</span>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          Ask to write SQL, MongoDB aggregation, JS mapping, or filter commands tailored to the active JSON schema.
        </div>
      </div>

      {/* Message Stream */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 10px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          return (
            <div
              key={idx}
              className="animate-fade-in"
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start"
              }}
            >
              <div style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginBottom: 4,
                fontWeight: 500,
                padding: "0 4px"
              }}>
                {isUser ? "You" : "AI Specialist"}
              </div>
              <div style={{
                padding: "12px 16px",
                borderRadius: "var(--radius-lg)",
                background: isUser ? "var(--accent)" : "var(--surface)",
                color: isUser ? "#fff" : "var(--text-primary)",
                border: isUser ? "none" : "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
                fontSize: 13,
                lineHeight: 1.6
              }}>
                {isUser ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                ) : (
                  renderMessageContent(m.content)
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ alignSelf: "flex-start", maxWidth: "80%", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>AI Specialist is writing…</div>
            <div style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
              width: 320,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div className="skeleton" style={{ height: 12, width: "90%" }} />
              <div className="skeleton" style={{ height: 12, width: "70%" }} />
              <div className="skeleton" style={{ height: 12, width: "80%" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts & Input Box */}
      <div style={{ padding: 20, background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        {/* Suggestion Pills */}
        {messages.length <= 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text-secondary)",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  outline: "none"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          style={{ display: "flex", gap: 10 }}
        >
          <textarea
            ref={inputRef}
            id="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to write a query, filter or aggregation..."
            rows={Math.min(6, input.split("\n").length || 1)}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
              transition: "all 0.15s ease",
              resize: "none",
              minHeight: "40px",
              maxHeight: "150px",
              lineHeight: "1.5",
              fontFamily: "inherit"
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            disabled={loading}
            aria-label="Ask AI query command"
          />
          <button
            id="ai-send-btn"
            type="submit"
            className="btn btn-primary"
            disabled={!input.trim() || loading}
            style={{ padding: "0 20px" }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
