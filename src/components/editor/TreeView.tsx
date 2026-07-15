"use client";
import { useState } from "react";

interface TreeViewProps {
  data: unknown;
  selectedPath: string;
  onSelect: (path: string) => void;
  path?: string;
  depth?: number;
}

function getType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string: "var(--success)", number: "#E0A020", boolean: "var(--accent)",
    null: "var(--text-muted)", array: "var(--danger)", object: "#7B6FF0",
  };
  return (
    <span style={{ fontSize: 10, color: colors[type] ?? "var(--text-muted)", marginLeft: 4, fontFamily: "var(--font-mono)" }}>
      {type}
    </span>
  );
}

export function TreeView({ data, selectedPath, onSelect, path = "$", depth = 0 }: TreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (p: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const renderNode = (key: string | number, value: unknown, nodePath: string, isLast: boolean) => {
    const type = getType(value);
    const isExpandable = type === "object" || type === "array";
    const isCollapsed = collapsed.has(nodePath);
    const isSelected = selectedPath === nodePath;
    const childCount = isExpandable ? (Array.isArray(value) ? (value as unknown[]).length : Object.keys(value as object).length) : 0;

    return (
      <div key={nodePath} className="tree-node" style={{ position: "relative" }}>
        {/* Connector line */}
        {depth > 0 && (
          <span style={{
            position: "absolute", left: -12, top: 0, bottom: isLast ? "50%" : 0,
            width: 1, background: "var(--border-strong)", pointerEvents: "none",
          }} />
        )}
        {depth > 0 && (
          <span style={{
            position: "absolute", left: -12, top: "50%", width: 10,
            height: 1, background: "var(--border-strong)", pointerEvents: "none",
          }} />
        )}

        <div
          className={isSelected ? "tree-node-selected" : ""}
          onClick={() => { onSelect(nodePath); if (isExpandable) toggle(nodePath); }}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px 3px 4px", cursor: "pointer",
            borderRadius: 4, fontSize: 13,
            userSelect: "none",
          }}
        >
          {isExpandable && (
            <span style={{ width: 16, color: "var(--text-muted)", fontFamily: "monospace", fontSize: 10, flexShrink: 0 }}>
              {isCollapsed ? "▶" : "▼"}
            </span>
          )}
          {!isExpandable && <span style={{ width: 16 }} />}

          <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {typeof key === "number" ? <span style={{ color: "var(--text-muted)" }}>[{key}]</span> : (
              <span style={{ color: "#7B6FF0" }}>&quot;{key}&quot;</span>
            )}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>:</span>

          {!isExpandable ? (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 12,
              color: type === "string" ? "var(--success)" : type === "number" ? "#E0A020" : type === "boolean" ? "var(--accent)" : "var(--text-muted)",
            }}>
              {type === "string" ? `"${String(value).slice(0, 60)}${String(value).length > 60 ? "…" : ""}"` : String(value)}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {Array.isArray(value) ? "[" : "{"}
              {isCollapsed && <span style={{ color: "var(--text-muted)", fontSize: 11 }}> {childCount} items </span>}
              {isCollapsed && (Array.isArray(value) ? "]" : "}")}
            </span>
          )}
          <TypeBadge type={type} />
        </div>

        {isExpandable && !isCollapsed && (
          <div style={{ paddingLeft: 24, position: "relative" }}>
            {Array.isArray(value)
              ? (value as unknown[]).map((item, i) =>
                  renderNode(i, item, `${nodePath}[${i}]`, i === (value as unknown[]).length - 1)
                )
              : Object.entries(value as object).map(([k, v], i, arr) =>
                  renderNode(k, v, `${nodePath}.${k}`, i === arr.length - 1)
                )}
            <span style={{ color: "var(--text-muted)", fontSize: 13, paddingLeft: 4 }}>
              {Array.isArray(value) ? "]" : "}"}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (data === null || data === undefined) return null;

  const type = getType(data);
  const isRoot = path === "$";

  if (isRoot && (type === "object" || type === "array")) {
    return (
      <div style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
          {Array.isArray(data) ? `[ ${(data as unknown[]).length} items ]` : `{ ${Object.keys(data as object).length} keys }`}
        </div>
        {Array.isArray(data)
          ? (data as unknown[]).map((item, i) =>
              renderNode(i, item, `$[${i}]`, i === (data as unknown[]).length - 1)
            )
          : Object.entries(data as object).map(([k, v], i, arr) =>
              renderNode(k, v, `$.${k}`, i === arr.length - 1)
            )}
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)" }}>
        {String(data)}
      </span>
    </div>
  );
}
