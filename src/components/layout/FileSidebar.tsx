"use client";
import { useState } from "react";
import { parseJSON } from "@/lib/json-utils";
import type { Blob } from "@/lib/types";

interface FileSidebarProps {
  blobs: Blob[];
  activeBlobId: string;
  onSelectBlob: (id: string) => void;
  onNewBlob: () => void;
  // D1 Props
  connectedTables: string[];
  activeTable: string | null;
  onSelectTable: (name: string) => void;
  onConnectDb: () => void;
  isDbLoading: boolean;
}

export function FileSidebar({
  blobs, activeBlobId, onSelectBlob, onNewBlob,
  connectedTables, activeTable, onSelectTable, onConnectDb, isDbLoading
}: FileSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = blobs.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="file-sidebar" aria-label="File sidebar">
      <div className="sidebar-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
            My workspace
          </span>
        </div>
        <input
          id="sidebar-search"
          className="sidebar-search"
          type="search"
          placeholder="⌘K  Search blobs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search blobs"
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <div className="sidebar-section">
          <span className="sidebar-label">Open</span>
        </div>

        {filtered.map((blob) => {
          const { error } = parseJSON(blob.content);
          const isValid = error === null;
          // De-highlight blob if we are viewing a database table
          const isActive = blob.id === activeBlobId && activeTable === null;
          return (
            <button
              key={blob.id}
              id={`blob-item-${blob.id}`}
              className={`blob-item ${isActive ? "active" : ""}`}
              onClick={() => onSelectBlob(blob.id)}
              aria-current={isActive ? "true" : undefined}
            >
              <span
                className={`blob-status-dot ${isValid ? "valid" : "invalid"}`}
                title={isValid ? "Valid JSON" : "Invalid JSON"}
              />
              <span className="blob-name">{blob.name}</span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>
            No blobs found
          </p>
        )}

        <button
          id="new-blob-btn"
          className="new-blob-btn"
          onClick={onNewBlob}
          aria-label="Create new blob"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          New blob
        </button>

        <div className="sidebar-section" style={{ marginTop: 12 }}>
          <span className="sidebar-label">Connected tables</span>
        </div>

        {connectedTables.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 8px" }}>
            {connectedTables.map((table) => {
              const isActive = activeTable === table;
              return (
                <button
                  key={table}
                  id={`table-item-${table}`}
                  className={`blob-item ${isActive ? "active" : ""}`}
                  onClick={() => onSelectTable(table)}
                  aria-current={isActive ? "true" : undefined}
                  style={{ paddingLeft: 12 }}
                >
                  <span
                    className="blob-status-dot valid"
                    style={{ background: "var(--accent)" }}
                    title="Live D1 Table"
                  />
                  <span className="blob-name" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {table}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "8px 16px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
              Connect a D1 table to query live data
            </p>
          </div>
        )}

        <div style={{ padding: "4px 16px 16px" }}>
          <button
            id="connect-table-btn"
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 8px" }}
            onClick={onConnectDb}
            disabled={isDbLoading}
          >
            {isDbLoading ? "Connecting…" : "+ Connect database / Refresh"}
          </button>
        </div>
      </div>
    </aside>
  );
}
