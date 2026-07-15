"use client";
import { useState } from "react";
import { formatJSON, minifyJSON } from "@/lib/json-utils";
import type { ParseResult } from "@/lib/types";

interface RawViewProps { content: string; parsed: ParseResult; }

export function RawView({ content, parsed }: RawViewProps) {
  const [mode, setMode] = useState<"formatted" | "minified">("formatted");
  const [copied, setCopied] = useState(false);

  const displayed = parsed.data
    ? mode === "formatted" ? formatJSON(parsed.data) : minifyJSON(parsed.data)
    : content;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new window.Blob([displayed], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `blob-${Date.now()}.json`; a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 2, background: "var(--border)", borderRadius: 6, padding: 2 }}>
          {(["formatted", "minified"] as const).map((m) => (
            <button
              key={m}
              id={`raw-mode-${m}`}
              className={`view-pill ${mode === m ? "active" : ""}`}
              onClick={() => setMode(m)}
              style={{ fontSize: 12 }}
            >
              {m === "formatted" ? "Formatted" : "Minified"}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button id="copy-raw-btn" className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button id="download-json-btn" className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={handleDownload}>
            Download
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", background: "#1e1e2e", padding: "20px" }}>
        <pre style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#cdd6f4", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.7, margin: 0 }}>
          {displayed}
        </pre>
      </div>
    </div>
  );
}
