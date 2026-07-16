/** Shared TypeScript types for NexBlob */

export interface Blob {
  id: string;
  workspace_id: string | null;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  ai_chat_history?: string;
}

export interface Comment {
  id: string;
  blob_id: string;
  path: string;
  author: string;
  body: string;
  created_at: number;
}

export interface Version {
  id: string;
  blob_id: string;
  content: string;
  created_at: number;
}

export type ViewMode = "editor" | "table" | "raw" | "sql" | "chart" | "diff" | "ai_page";

export interface BlobMeta {
  id: string;
  name: string;
  updated_at: number;
  isValid: boolean;
}

export interface ParseResult {
  data: unknown;
  error: string | null;
  lineCount: number;
  byteSize: number;
  keyCount: number;
  depth: number;
}

export type ExpiryOption = "never" | "30d" | "75d" | "custom";

export interface D1Connection {
  id: string;
  name: string;
  accountId: string;
  databaseId: string;
  apiToken: string;
}


