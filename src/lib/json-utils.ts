/** JSON utility helpers */
import type { ParseResult } from "./types";

export function parseJSON(text: string): ParseResult {
  const textStr = text ?? "{}";
  const lines = textStr.split("\n");
  const byteSize = new TextEncoder().encode(textStr).length;

  try {
    const data = JSON.parse(textStr);
    const keyCount = countKeys(data);
    const depth = calcDepth(data);
    return { data, error: null, lineCount: lines.length, byteSize, keyCount, depth };
  } catch (e) {
    return {
      data: null,
      error: (e as Error).message,
      lineCount: lines.length,
      byteSize,
      keyCount: 0,
      depth: 0,
    };
  }
}

export function formatJSON(data: unknown, indent = 2): string {
  return JSON.stringify(data, null, indent);
}

export function minifyJSON(data: unknown): string {
  return JSON.stringify(data);
}

function countKeys(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((acc: number, v) => acc + countKeys(v), 0);
  const keys = Object.keys(value as object);
  return (
    keys.length +
    keys.reduce((acc, k) => acc + countKeys((value as Record<string, unknown>)[k]), 0)
  );
}

function calcDepth(value: unknown, d = 0): number {
  if (value === null || typeof value !== "object") return d;
  if (Array.isArray(value)) {
    if (value.length === 0) return d;
    return Math.max(...value.map((v) => calcDepth(v, d + 1)));
  }
  const children = Object.values(value as object);
  if (children.length === 0) return d;
  return Math.max(...children.map((v) => calcDepth(v, d + 1)));
}

export function generateId(): string {
  // nanoid-style random id (browser + edge compatible)
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(21));
  for (const byte of bytes) {
    id += alphabet[byte % alphabet.length];
  }
  return id;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function expiryToTimestamp(option: string): number | null {
  const now = Date.now();
  switch (option) {
    case "30d":
      return now + 30 * 24 * 60 * 60 * 1000;
    case "75d":
      return now + 75 * 24 * 60 * 60 * 1000;
    case "never":
    default:
      return null;
  }
}

export function jsonToCsv(data: unknown, delimiter: "," | "\t" = ","): string {
  if (!data) return "";
  let rows: Record<string, unknown>[] = [];

  if (Array.isArray(data)) {
    rows = data.map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : { value: item }));
  } else if (typeof data === "object" && data !== null) {
    rows = [data as Record<string, unknown>];
  } else {
    rows = [{ value: data }];
  }

  if (rows.length === 0) return "";

  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(delimiter);
  const rowLines = rows.map((r) => headers.map((h) => escapeCell(r[h])).join(delimiter));

  return [headerLine, ...rowLines].join("\n");
}

export function jsonToYaml(data: unknown, indentLevel = 0): string {
  const pad = "  ".repeat(indentLevel);

  if (data === null || data === undefined) return "null";
  if (typeof data === "boolean" || typeof data === "number") return String(data);
  if (typeof data === "string") {
    if (data.includes("\n") || data.includes(":") || data.includes("#")) {
      return JSON.stringify(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    return data
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const itemYaml = jsonToYaml(item, indentLevel + 1).trimStart();
          return `${pad}- ${itemYaml}`;
        }
        return `${pad}- ${jsonToYaml(item, indentLevel + 1)}`;
      })
      .join("\n");
  }

  if (typeof data === "object") {
    const keys = Object.keys(data as object);
    if (keys.length === 0) return "{}";
    return keys
      .map((key) => {
        const val = (data as Record<string, unknown>)[key];
        if (typeof val === "object" && val !== null) {
          return `${pad}${key}:\n${jsonToYaml(val, indentLevel + 1)}`;
        }
        return `${pad}${key}: ${jsonToYaml(val, indentLevel + 1)}`;
      })
      .join("\n");
  }

  return String(data);
}

export function exportBlobFile(content: string, name: string, format: "json" | "csv" | "yaml" | "tsv") {
  let output = content;
  let mimeType = "application/json";
  let ext = "json";

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {}

  if (format === "csv") {
    output = parsed ? jsonToCsv(parsed, ",") : content;
    mimeType = "text/csv";
    ext = "csv";
  } else if (format === "tsv") {
    output = parsed ? jsonToCsv(parsed, "\t") : content;
    mimeType = "text/tab-separated-values";
    ext = "tsv";
  } else if (format === "yaml") {
    output = parsed ? jsonToYaml(parsed) : content;
    mimeType = "text/yaml";
    ext = "yaml";
  }

  const safeName = (name || "blob").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const blob = new window.Blob([output], { type: `${mimeType};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}
