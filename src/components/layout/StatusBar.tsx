"use client";
import { formatBytes } from "@/lib/json-utils";
import type { ParseResult } from "@/lib/types";

interface StatusBarProps {
  parsed: ParseResult;
  onExplain: () => void;
}

export function StatusBar({ parsed, onExplain }: StatusBarProps) {
  const { error, lineCount, byteSize, keyCount, depth } = parsed;

  return (
    <footer className="status-bar" role="contentinfo" aria-label="Document statistics">
      {error ? (
        <span className="status-invalid" aria-live="polite">✕ {error}</span>
      ) : (
        <span className="status-valid">✓ Valid JSON</span>
      )}

      <span className="status-sep">|</span>
      <span title="Lines">{lineCount.toLocaleString()} lines</span>
      <span className="status-sep">|</span>
      <span title="Size">{formatBytes(byteSize)}</span>
      <span className="status-sep">|</span>
      <span title="Key count">{keyCount.toLocaleString()} keys</span>
      <span className="status-sep">|</span>
      <span title="Nesting depth">depth {depth}</span>

      <button
        id="explain-chip"
        className="explain-chip"
        onClick={onExplain}
        aria-label="Explain this JSON with AI"
      >
        ✦ Explain
      </button>
    </footer>
  );
}
