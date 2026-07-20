"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { formatJSON } from "@/lib/json-utils";
import type { ParseResult } from "@/lib/types";

export interface DiffLine {
  type: "added" | "removed" | "unchanged" | "placeholder";
  value: string;
}

// LCS-based Side-by-Side Alignment
export function alignDiffs(oldStr: string, newStr: string): { leftLines: DiffLine[]; rightLines: DiffLine[] } {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  const dp: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      leftLines.unshift({ type: "unchanged", value: oldLines[i - 1] });
      rightLines.unshift({ type: "unchanged", value: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      leftLines.unshift({ type: "placeholder", value: "" });
      rightLines.unshift({ type: "added", value: newLines[j - 1] });
      j--;
    } else {
      leftLines.unshift({ type: "removed", value: oldLines[i - 1] });
      rightLines.unshift({ type: "placeholder", value: "" });
      i--;
    }
  }

  return { leftLines, rightLines };
}

// Diff Panel to display left/right side of comparison
interface DiffSidePanelProps {
  title: string;
  lines: DiffLine[];
  highlightType: "added" | "removed";
  stats?: { added: number; removed: number };
  onModify?: () => void;
}

export function DiffSidePanel({ title, lines, highlightType, stats, onModify }: DiffSidePanelProps) {
  let lineNum = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#1e1e2e" }}>
      {/* Panel Header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {stats && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginRight: 8, fontSize: 11 }}>
              <span style={{ color: "var(--success)", fontWeight: 600 }}>+{stats.added} additions</span>
              <span style={{ color: "var(--danger)", fontWeight: 600 }}>-{stats.removed} deletions</span>
            </div>
          )}
          {onModify && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: "3px 10px" }}
              onClick={onModify}
            >
              Modify B
            </button>
          )}
        </div>
      </div>

      {/* Code Area */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.6, color: "#cdd6f4", whiteSpace: "pre", margin: 0 }}>
          {lines.map((line, idx) => {
            const isPlaceholder = line.type === "placeholder";
            if (!isPlaceholder) {
              lineNum++;
            }

            let backgroundColor = "transparent";
            let color = "#cdd6f4";
            let prefix = "  ";

            if (line.type === "added" && highlightType === "added") {
              backgroundColor = "rgba(166, 227, 161, 0.15)";
              color = "#a6e3a1";
              prefix = "+ ";
            } else if (line.type === "removed" && highlightType === "removed") {
              backgroundColor = "rgba(243, 139, 168, 0.15)";
              color = "#f38ba8";
              prefix = "- ";
            } else if (isPlaceholder) {
              backgroundColor = "rgba(255, 255, 255, 0.02)";
              color = "rgba(255, 255, 255, 0.1)";
              prefix = "  ";
            }

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  backgroundColor,
                  color,
                  padding: "1px 8px",
                  borderRadius: 2
                }}
              >
                {/* Aligned Line Number */}
                <span style={{ width: 30, color: "rgba(205, 214, 244, 0.3)", userSelect: "none", display: "inline-block", textAlign: "right", marginRight: 12 }}>
                  {!isPlaceholder ? lineNum : ""}
                </span>
                {/* Diff Prefix (+ or -) */}
                <span style={{ color: line.type === "unchanged" ? "rgba(205, 214, 244, 0.4)" : color, userSelect: "none", marginRight: 8 }}>
                  {prefix}
                </span>
                {/* Code Content */}
                <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {isPlaceholder ? "" : line.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Right panel component for pasting comparison JSON
interface DiffInputViewProps {
  compareContent: string;
  onChange: (value: string) => void;
  onCompare: () => void;
  onClear: () => void;
}

export function DiffInputView({ compareContent, onChange, onCompare, onClear }: DiffInputViewProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--surface)" }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>JSON Diff Checker</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
            Paste Modified JSON B below to compare with active JSON
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            id="diff-compare-btn"
            className="btn btn-primary"
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={onCompare}
            disabled={!compareContent.trim()}
          >
            Compare
          </button>
          <button
            id="diff-clear-btn"
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Input area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "6px 12px", background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 500, color: "var(--text-secondary)" }}>
          Paste Modified JSON (B):
        </div>
        <textarea
          ref={inputRef}
          id="diff-compare-input"
          value={compareContent}
          onChange={(e) => onChange(e.target.value)}
          placeholder='Paste JSON B here (e.g. {"id": 1001, "customer": "Bob", ...})'
          style={{
            flex: 1,
            width: "100%",
            padding: 12,
            border: "none",
            resize: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            background: "var(--surface)",
            color: "var(--text-primary)",
            outline: "none",
            lineHeight: 1.5
          }}
          aria-label="Modified JSON input to compare"
        />
      </div>
    </div>
  );
}

// Fallback legacy export to prevent broken imports
export function DiffView({ content, parsed }: { content: string; parsed: ParseResult }) {
  const [compareContent, setCompareContent] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const activeFormatted = useMemo(() => {
    if (parsed.data) {
      try {
        return formatJSON(parsed.data);
      } catch {
        return content;
      }
    }
    return content;
  }, [content, parsed.data]);

  const compareFormatted = useMemo(() => {
    if (!compareContent) return "";
    try {
      const obj = JSON.parse(compareContent);
      return formatJSON(obj);
    } catch {
      return compareContent;
    }
  }, [compareContent]);

  const { leftLines, rightLines } = useMemo(() => {
    if (!showDiff) return { leftLines: [], rightLines: [] };
    return alignDiffs(activeFormatted, compareFormatted);
  }, [showDiff, activeFormatted, compareFormatted]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    leftLines.forEach((line) => {
      if (line.type === "removed") removed++;
    });
    rightLines.forEach((line) => {
      if (line.type === "added") added++;
    });
    return { added, removed };
  }, [leftLines, rightLines]);

  if (showDiff) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <div style={{ flex: 1, borderRight: "1px solid var(--border)" }}>
          <DiffSidePanel title="Original JSON (A)" lines={leftLines} highlightType="removed" />
        </div>
        <div style={{ flex: 1 }}>
          <DiffSidePanel title="Modified JSON (B)" lines={rightLines} highlightType="added" stats={stats} onModify={() => setShowDiff(false)} />
        </div>
      </div>
    );
  }

  return (
    <DiffInputView
      compareContent={compareContent}
      onChange={setCompareContent}
      onCompare={() => setShowDiff(true)}
      onClear={() => setCompareContent("")}
    />
  );
}
