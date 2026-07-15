"use client";
import { useMemo, useState } from "react";
import { inferSchema } from "@/lib/schema-inference";
import type { ParseResult } from "@/lib/types";

interface TableViewProps { parsed: ParseResult; }

function renderCell(value: unknown) {
  if (value === null || value === undefined) {
    return <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={`badge ${value ? "badge-success" : "badge-muted"}`}>{String(value)}</span>;
  }
  if (typeof value === "object") {
    return <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{Array.isArray(value) ? `[${(value as unknown[]).length}]` : "{…}"}</span>;
  }
  const str = String(value);
  // Status-like fields
  const statusMap: Record<string, string> = {
    shipped: "badge-accent", delivered: "badge-success", pending: "badge-warning",
    cancelled: "badge-danger", active: "badge-success", inactive: "badge-muted",
    admin: "badge-accent", editor: "badge-warning", viewer: "badge-muted",
  };
  if (statusMap[str.toLowerCase()]) {
    return <span className={`badge ${statusMap[str.toLowerCase()]}`}>{str}</span>;
  }
  return <span>{str.length > 80 ? str.slice(0, 80) + "…" : str}</span>;
}

export function TableViewComponent({ parsed }: TableViewProps) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const schema = useMemo(() => parsed.data ? inferSchema(parsed.data) : null, [parsed.data]);

  const rows: Record<string, unknown>[] = useMemo(() => {
    if (!parsed.data) return [];
    if (Array.isArray(parsed.data)) {
      return (parsed.data as Record<string, unknown>[]).filter(
        (r) => typeof r === "object" && r !== null && !Array.isArray(r)
      );
    }
    return [parsed.data as Record<string, unknown>];
  }, [parsed.data]);

  const columns = useMemo(() => schema ? Object.keys(schema.fields) : [], [schema]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      q ? Object.values(r).some((v) => String(v).toLowerCase().includes(q)) : true
    );
  }, [rows, filter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportCSV = () => {
    const header = columns.join(",");
    const rowsCSV = sorted.map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(",")).join("\n");
    const blob = new window.Blob([header + "\n" + rowsCSV], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "export.csv"; a.click();
  };

  if (parsed.error) {
    return (
      <div style={{ padding: 32, color: "var(--danger)", fontSize: 13 }}>Invalid JSON: {parsed.error}</div>
    );
  }
  if (rows.length === 0) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
        No tabular data found. Table view works best with an array of objects.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)", flexShrink: 0 }}>
        <input
          id="table-filter"
          style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--surface)", color: "var(--text-primary)", outline: "none" }}
          placeholder="Filter rows…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter table rows"
        />
        <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 4 }}>
          {sorted.length} / {rows.length} rows
        </span>
        <button id="export-csv-btn" className="btn btn-secondary" style={{ marginLeft: "auto", fontSize: 12, padding: "5px 12px" }} onClick={exportCSV}>
          Export CSV
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} onClick={() => handleSort(col)} style={{ cursor: "pointer" }}>
                  {col}
                  {sortKey === col && <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col}>{renderCell(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
