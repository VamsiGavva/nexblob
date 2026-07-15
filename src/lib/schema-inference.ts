/**
 * Schema Inference Engine
 * Foundational layer — detects types/structure from any loaded JSON.
 * Used by: Table view, TypeScript generation, SQL conversion, drift detection.
 */

export type InferredType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "array"
  | "object"
  | "mixed"
  | "date";

export interface FieldSchema {
  key: string;
  path: string;
  type: InferredType;
  nullable: boolean;
  unique?: boolean;
  examples: unknown[];
  children?: Record<string, FieldSchema>;
  arrayItemType?: InferredType;
}

export interface InferredSchema {
  root: InferredType;
  fields: Record<string, FieldSchema>;
  rowCount?: number; // if root is array-of-objects
  isTabular: boolean; // can be rendered as flat table
  depth: number;
  keyCount: number;
}

function detectType(value: unknown): InferredType {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    // Detect ISO date strings
    if (/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(value)) return "date";
    return "string";
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "mixed";
}

function mergeType(a: InferredType, b: InferredType): InferredType {
  if (a === b) return a;
  if (a === "null") return b;
  if (b === "null") return a;
  return "mixed";
}

function inferField(
  key: string,
  path: string,
  values: unknown[]
): FieldSchema {
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const nullable = values.some((v) => v === null || v === undefined);

  let type: InferredType = "mixed";
  const examples: unknown[] = [];

  for (const v of nonNull.slice(0, 5)) {
    const t = detectType(v);
    type = examples.length === 0 ? t : mergeType(type, t);
    examples.push(v);
  }

  const field: FieldSchema = { key, path, type, nullable, examples };

  if (type === "object" && nonNull.length > 0) {
    const allKeys = new Set<string>();
    nonNull.forEach((v) => Object.keys(v as object).forEach((k) => allKeys.add(k)));
    field.children = {};
    for (const childKey of allKeys) {
      const childValues = nonNull.map((v) => (v as Record<string, unknown>)[childKey]);
      field.children[childKey] = inferField(
        childKey,
        `${path}.${childKey}`,
        childValues
      );
    }
  }

  if (type === "array" && nonNull.length > 0) {
    const flatItems = (nonNull as unknown[][]).flat();
    const itemTypes = flatItems.map(detectType);
    const unique = new Set(itemTypes);
    field.arrayItemType = unique.size === 1 ? [...unique][0] : "mixed";
  }

  return field;
}

function calcDepth(value: unknown, d = 0): number {
  if (value === null || typeof value !== "object") return d;
  if (Array.isArray(value)) {
    return Math.max(...value.map((v) => calcDepth(v, d + 1)), d);
  }
  const children = Object.values(value as object);
  if (children.length === 0) return d;
  return Math.max(...children.map((v) => calcDepth(v, d + 1)));
}

function countKeys(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((acc, v) => acc + countKeys(v), 0);
  const keys = Object.keys(value as object);
  return keys.length + keys.reduce((acc, k) => acc + countKeys((value as Record<string, unknown>)[k]), 0);
}

export function inferSchema(data: unknown): InferredSchema {
  const rootType = detectType(data);
  const depth = calcDepth(data);
  const keyCount = countKeys(data);

  // Array of objects → tabular
  if (rootType === "array" && Array.isArray(data) && data.length > 0) {
    const firstNonNull = data.find((r) => r !== null && typeof r === "object" && !Array.isArray(r));
    if (firstNonNull) {
      const allKeys = new Set<string>();
      data.forEach((row) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          Object.keys(row as object).forEach((k) => allKeys.add(k));
        }
      });
      const fields: Record<string, FieldSchema> = {};
      for (const key of allKeys) {
        const values = data.map((row) =>
          row && typeof row === "object" ? (row as Record<string, unknown>)[key] : undefined
        );
        fields[key] = inferField(key, key, values);
      }
      return {
        root: "array",
        fields,
        rowCount: data.length,
        isTabular: true,
        depth,
        keyCount,
      };
    }
  }

  // Object → fields at top level
  if (rootType === "object" && data !== null) {
    const fields: Record<string, FieldSchema> = {};
    for (const [key, value] of Object.entries(data as object)) {
      fields[key] = inferField(key, key, [value]);
    }
    return { root: "object", fields, isTabular: false, depth, keyCount };
  }

  return { root: rootType, fields: {}, isTabular: false, depth, keyCount };
}

/** Flatten a schema's fields for CSV/Table headers */
export function flattenFieldPaths(
  schema: InferredSchema
): string[] {
  return Object.keys(schema.fields);
}
