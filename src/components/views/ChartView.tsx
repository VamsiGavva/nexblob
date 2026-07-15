"use client";
import { useMemo, useState } from "react";
import { inferSchema } from "@/lib/schema-inference";
import type { ParseResult } from "@/lib/types";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const COLORS = ["#5B4FE9", "#1A9E6A", "#B5790A", "#D8434B", "#7B6FF0", "#22C87A", "#E0A020", "#F05560"];

interface ChartViewProps { parsed: ParseResult; }

type ChartType = "bar" | "line" | "pie";

export function ChartView({ parsed }: ChartViewProps) {
  const schema = useMemo(() => parsed.data ? inferSchema(parsed.data) : null, [parsed.data]);
  const [chartType, setChartType] = useState<ChartType>("bar");

  const rows: Record<string, unknown>[] = useMemo(() => {
    if (!parsed.data || !Array.isArray(parsed.data)) return [];
    return (parsed.data as Record<string, unknown>[]).filter(
      (r) => typeof r === "object" && r !== null && !Array.isArray(r)
    );
  }, [parsed.data]);

  const numericKeys = useMemo(() => {
    if (!schema) return [];
    return Object.entries(schema.fields)
      .filter(([, f]) => f.type === "number")
      .map(([k]) => k);
  }, [schema]);

  const labelKey = useMemo(() => {
    if (!schema) return null;
    const strKeys = Object.entries(schema.fields).filter(([, f]) => f.type === "string").map(([k]) => k);
    return strKeys[0] ?? null;
  }, [schema]);

  const [valueKey, setValueKey] = useState<string | null>(null);
  const activeKey = valueKey ?? numericKeys[0] ?? null;

  const chartData = useMemo(() =>
    rows.slice(0, 30).map((r) => ({
      name: labelKey ? String(r[labelKey] ?? "").slice(0, 20) : String(rows.indexOf(r)),
      value: typeof r[activeKey ?? ""] === "number" ? r[activeKey ?? ""] as number : 0,
    })),
    [rows, labelKey, activeKey]
  );

  const totalValue = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData]);
  const maxValue = useMemo(() => Math.max(...chartData.map((d) => d.value)), [chartData]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
        No numeric data found. Chart view works with arrays of objects containing numeric fields.
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "auto" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, background: "var(--border)", borderRadius: 6, padding: 2 }}>
          {(["bar", "line", "pie"] as ChartType[]).map((t) => (
            <button key={t} id={`chart-type-${t}`} className={`view-pill ${chartType === t ? "active" : ""}`} onClick={() => setChartType(t)} style={{ fontSize: 12 }}>
              {t === "bar" ? "Bar" : t === "line" ? "Line" : "Pie"}
            </button>
          ))}
        </div>
        {numericKeys.length > 1 && (
          <select
            id="chart-value-select"
            value={activeKey ?? ""}
            onChange={(e) => setValueKey(e.target.value)}
            style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--surface)", color: "var(--text-primary)" }}
            aria-label="Select value field"
          >
            {numericKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        )}
      </div>

      {/* Metric cards */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Total", value: totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
          { label: "Max", value: maxValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
          { label: "Count", value: rows.length.toString() },
        ].map((m) => (
          <div key={m.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 20px", minWidth: 120 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 280, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="70%"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
