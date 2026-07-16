"use client";
import { useState, useMemo, useEffect } from "react";
import type { ParseResult } from "@/lib/types";

interface SqlViewProps {
  parsed: ParseResult;
  activeConnectionId: string | null;
  activeTable: string | null;
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

export function SqlView({ parsed, activeConnectionId, activeTable }: SqlViewProps) {
  const [query, setQuery] = useState("SELECT * FROM ? LIMIT 10");
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  // Sync default query when connection or selected table changes
  useEffect(() => {
    if (activeConnectionId) {
      if (activeTable) {
        setQuery(`SELECT * FROM ${activeTable} LIMIT 10`);
      } else {
        setQuery("SELECT * FROM sqlite_master WHERE type='table'");
      }
    } else {
      setQuery("SELECT * FROM ? LIMIT 10");
    }
    setResults(null);
    setError(null);
    setExecTime(null);
  }, [activeConnectionId, activeTable]);

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
          id="sql-query-input"
          className="sql-editor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runQuery(); }}
          rows={4}
          aria-label="SQL query input"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
            onClick={() => setQuery("SELECT * FROM ? LIMIT 10")}
          >
            Reset
          </button>
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
