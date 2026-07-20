"use client";
import { useState } from "react";
import type { ParseResult } from "@/lib/types";

type AiTab = "explain" | "typescript" | "sql" | "sample";

interface AiPanelProps {
  content: string;
  parsed: ParseResult;
  onClose?: () => void;
}

const TABS: { id: AiTab; label: string; description: string }[] = [
  { id: "explain", label: "Explain Data", description: "Summary of schema, patterns & relationships" },
  { id: "typescript", label: "TypeScript", description: "Generate type-safe interfaces" },
  { id: "sql", label: "SQL DDL", description: "Create table and insert queries" },
  { id: "sample", label: "Generate Sample", description: "5 new mock records matching schema" },
];

export function AiPanel({ content, onClose }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<AiTab>("explain");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runAi = async () => {
    setLoading(true);
    setError(null);
    setOutput(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: activeTab, content }),
      });
      const data = await res.json() as { result?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setOutput(data.result ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (output) {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Panel Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "between",
        background: "var(--surface-sunken)", flexShrink: 0
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            ✦ AI Assistant
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 2 }}>
            Powered by Gemini 3.5 Flash
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: 16, padding: 4, display: "flex",
              alignItems: "center", justifyContent: "center", borderRadius: "50%",
              width: 24, height: 24, transition: "background 0.2s"
            }}
            id="close-ai-sidebar"
            aria-label="Close AI panel"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs / Actions Selectors */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Select Action</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`ai-tab-${tab.id}`}
                onClick={() => { setActiveTab(tab.id); setOutput(null); setError(null); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "start",
                  padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid",
                  borderColor: activeTab === tab.id ? "var(--accent)" : "var(--border)",
                  background: activeTab === tab.id ? "var(--accent-bg)" : "var(--surface)",
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s ease"
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: activeTab === tab.id ? "var(--accent-ink)" : "var(--text-primary)"
                }}>
                  {tab.label}
                </span>
                <span style={{
                  fontSize: 11, color: activeTab === tab.id ? "var(--accent-ink)" : "var(--text-secondary)",
                  opacity: activeTab === tab.id ? 0.85 : 1, marginTop: 2
                }}>
                  {tab.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate triggers */}
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexShrink: 0 }}>
          <button
            id="ai-run-btn"
            className="btn btn-primary"
            onClick={runAi}
            disabled={loading}
            style={{ flex: 1, justifyContent: "center", padding: "8px 0" }}
            aria-label="Generate AI response"
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ animation: "pulse 1s infinite" }}>◈</span> Processing…
              </span>
            ) : "✦ Run Analysis"}
          </button>
          {output && (
            <button id="ai-copy-btn" className="btn btn-secondary" onClick={copy} style={{ fontSize: 12 }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 12, lineHeight: 1.5, border: "1px solid rgba(255,118,117,0.2)" }}>
            {error}
          </div>
        )}

        {/* Output view */}
        {loading && (
          <div style={{ display: "flex", gap: 8, flexDirection: "column", padding: "12px 0" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 14, width: `${95 - i * 10}%` }} />
            ))}
          </div>
        )}

        {!output && !loading && !error && (
          <div style={{
            background: "var(--surface-sunken)", border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)", padding: 32, color: "var(--text-muted)", fontSize: 12,
            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, flex: 1
          }}>
            <span style={{ fontSize: 24 }}>✦</span>
            <span>Click <b>Run Analysis</b> to process the active JSON document.</span>
          </div>
        )}

        {output && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output</span>
            <pre className="ai-output animate-fade-in" style={{ flex: 1, minHeight: 200, maxHeight: "none" }}>
              <code>{output}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
