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
