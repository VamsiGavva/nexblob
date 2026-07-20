"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import type { ParseResult } from "@/lib/types";

interface SqlViewProps {
  parsed: ParseResult;
  activeConnectionId: string | null;
  activeTable: string | null;
  query: string;
  setQuery: (q: string) => void;
  defaultQuery: string;
  onCreateBlobWithContent?: (content: string, name?: string) => void;
}

// Lazy-load alasql ONLY on client — uses the browser-only shim to avoid react-native deps
type AlasqlFn = (query: string, params?: unknown[]) => unknown;
let alasqlCache: AlasqlFn | null = null;
async function getAlasql(): Promise<AlasqlFn> {
  if (typeof window === "undefined") throw new Error("SQL view requires a browser");
  if (!alasqlCache) {
    const mod = await import("@/lib/alasql-browser");
    alasqlCache = mod.default;
  }
  return alasqlCache;
}

export function SqlView({
  parsed,
  activeConnectionId,
  activeTable,
  query,
  setQuery,
  defaultQuery,
  onCreateBlobWithContent,
}: SqlViewProps) {
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear query results and errors when database connection or table changes
  useEffect(() => {
    setResults(null);
    setError(null);
    setExecTime(null);
  }, [activeConnectionId, activeTable]);

  const handleCopyJson = async () => {
    if (!results) return;
    await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateBlob = () => {
    if (!results || !onCreateBlobWithContent) return;
    const jsonString = JSON.stringify(results, null, 2);
    const querySummary = query.replace(/\s+/g, " ").trim();
    const name = querySummary.length > 25 ? `Query Result (${querySummary.slice(0, 22)}...)` : `Query Result (${querySummary})`;
    onCreateBlobWithContent(jsonString, name);
  };

  const rows = useMemo(() => {
    if (!parsed.data) return [];
    if (Array.isArray(parsed.data)) return parsed.data as Record<string, unknown>[];
    return [parsed.data as Record<string, unknown>];
  }, [parsed.data]);

  const resultCols = useMemo(() => {
    if (!results || results.length === 0) return [];
    return Object.keys(results[0]);
  }, [results]);

  const runQuery = async () => {
    setRunning(true);
    setError(null);
    const start = performance.now();
    try {
      if (activeConnectionId) {
        // Execute on remote Cloudflare D1 Database connection
        const res = await fetch(`/api/connections/${activeConnectionId}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: query }),
        });

        let data: any;
        try {
          data = await res.json();
        } catch {
          throw new Error("Invalid response format from server");
        }

        if (!res.ok || data.error) {
          throw new Error(data.error || "Query failed");
        }

        setResults(data.rows || []);
      } else {
        // Execute locally via AlaSQL on active JSON blob
        const alasql = await getAlasql();
        const res = alasql(query, [rows]);
        setResults(Array.isArray(res) ? res : [{ result: String(res) }]);
      }
      setExecTime(performance.now() - start);
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: 16, gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>SQL query</label>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Use <code style={{ fontFamily: "var(--font-mono)", background: "var(--border)", padding: "1px 4px", borderRadius: 3 }}>?</code> to reference the active JSON as a table
          </span>
        </div>
        <textarea
          ref={inputRef}
          id="sql-query-input"
          className="sql-editor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runQuery(); }}
          rows={4}
          aria-label="SQL query input"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            id="run-sql-btn"
            className="btn btn-primary"
            onClick={runQuery}
            disabled={running}
            aria-label="Run SQL query"
          >
            {running ? "Running…" : "▷ Run"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setQuery(defaultQuery)}
          >
            Reset
          </button>
          {results && results.length > 0 && (
            <>
              <button
                id="save-query-as-blob-btn"
                className="btn btn-secondary"
                onClick={handleCreateBlob}
                aria-label="Create JSON Blob from Query Results"
                title="Create a new JSON document from these query results"
              >
                ✦ Save as JSON Blob
              </button>
              <button
                id="copy-query-json-btn"
                className="btn btn-ghost"
                onClick={handleCopyJson}
                aria-label="Copy query results as JSON"
                style={{ fontSize: 12 }}
              >
                {copied ? "Copied! ✓" : "Copy JSON"}
              </button>
            </>
          )}
          {execTime !== null && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", marginLeft: "auto" }}>
              {results?.length ?? 0} rows · {execTime.toFixed(1)}ms
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          <table className="data-table">
            <thead>
              <tr>{resultCols.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i}>
                  {resultCols.map((c) => (
                    <td key={c}>{row[c] === null ? <span style={{ color: "var(--text-muted)" }}>null</span> : String(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results && results.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Query returned 0 rows.</div>
      )}
    </div>
  );
}
