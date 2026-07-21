"use client";
import { useState } from "react";
import { parseJSON } from "@/lib/json-utils";
import type { Blob, D1Connection } from "@/lib/types";

interface FileSidebarProps {
  blobs: Blob[];
  activeBlobId: string;
  onSelectBlob: (id: string) => void;
  onNewBlob: () => void;
  onDeleteBlob?: (id: string) => void;
  // D1 Props
  connections: D1Connection[];
  activeConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
  onAddConnection: (name: string, accountId: string, dbId: string, apiToken: string) => void;
  onDeleteConnection: (id: string) => void;
  connectedTables: string[];
  activeTable: string | null;
  onSelectTable: (name: string) => void;
  isDbLoading: boolean;
  dbError: string | null;
}

export function FileSidebar({
  blobs, activeBlobId, onSelectBlob, onNewBlob, onDeleteBlob,
  connections, activeConnectionId, onSelectConnection, onAddConnection, onDeleteConnection,
  connectedTables, activeTable, onSelectTable, isDbLoading, dbError
}: FileSidebarProps) {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dbId, setDbId] = useState("");
  const [apiToken, setApiToken] = useState("");

  const filtered = blobs.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name || !accountId || !dbId || !apiToken) {
      setFormError("All fields are required");
      return;
    }
    try {
      onAddConnection(name.trim(), accountId.trim(), dbId.trim(), apiToken.trim());
      setIsModalOpen(false);
      setName("");
      setAccountId("");
      setDbId("");
      setApiToken("");
    } catch (err: any) {
      setFormError(err.message || "Failed to add connection");
    }
  };

  return (
    <aside className="file-sidebar" aria-label="File sidebar">
      <div className="sidebar-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <img src="/logo.png" alt="NexBlob" style={{ width: 20, height: 20, borderRadius: 4 }} />
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

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div className="sidebar-section">
          <span className="sidebar-label">Open</span>
        </div>

        {filtered.map((blob) => {
          const { error } = parseJSON(blob.content);
          const isValid = error === null;
          const isActive = blob.id === activeBlobId && activeTable === null && activeConnectionId === null;
          return (
            <div
              key={blob.id}
              id={`blob-item-${blob.id}`}
              data-id={blob.id}
              className={`blob-item ${isActive ? "active" : ""}`}
              onClick={() => {
                onSelectConnection(null);
                onSelectBlob(blob.id);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectConnection(null);
                  onSelectBlob(blob.id);
                }
              }}
              aria-current={isActive ? "true" : undefined}
            >
              <span
                className={`blob-status-dot ${isValid ? "valid" : "invalid"}`}
                title={isValid ? "Valid JSON" : "Invalid JSON"}
              />
              <span className="blob-name">{blob.name}</span>
              {onDeleteBlob && (
                <button
                  className="blob-delete-btn"
                  id={`delete-blob-${blob.id}`}
                  title="Delete blob"
                  aria-label={`Delete blob ${blob.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${blob.name}"?`)) {
                      onDeleteBlob(blob.id);
                    }
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>
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
          onClick={() => {
            onSelectConnection(null);
            onNewBlob();
          }}
          aria-label="Create new blob"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          New blob
        </button>

        <div className="sidebar-section" style={{ marginTop: 12 }}>
          <span className="sidebar-label">Connected D1 Databases</span>
        </div>

        {connections.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px" }}>
            {connections.map((conn) => {
              const isConnActive = activeConnectionId === conn.id;
              return (
                <div key={conn.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div className={`conn-header ${isConnActive ? "active" : ""}`} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 12px",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                    background: "var(--surface-sunken)",
                    borderRadius: "var(--radius)",
                    borderLeft: isConnActive ? "3px solid var(--accent)" : "none"
                  }}>
                    <button
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        fontWeight: isConnActive ? 600 : "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        flex: 1,
                        padding: "4px 0",
                        fontSize: 11,
                        fontFamily: "var(--font-heading)"
                      }}
                      onClick={() => onSelectConnection(conn.id)}
                    >
                      🗄️ {conn.name}
                    </button>
                    <button
                      className="conn-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to disconnect ${conn.name}?`)) {
                          onDeleteConnection(conn.id);
                        }
                      }}
                      title="Delete Connection"
                      aria-label={`Delete connection ${conn.name}`}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        padding: "2px 4px",
                        borderRadius: 4,
                        transition: "all 0.2s"
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {isConnActive && (
                    <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                      {isDbLoading ? (
                        <span style={{ color: "var(--text-muted)", fontSize: 11, padding: "4px 12px" }}>
                          Loading tables…
                        </span>
                      ) : dbError ? (
                        <span style={{ color: "var(--invalid)", fontSize: 11, padding: "4px 12px", wordBreak: "break-all" }}>
                          ⚠️ {dbError}
                        </span>
                      ) : connectedTables.length > 0 ? (
                        connectedTables.map((table) => {
                          const isTableActive = activeTable === table;
                          return (
                            <button
                              key={table}
                              id={`table-item-${table}`}
                              className={`blob-item ${isTableActive ? "active" : ""}`}
                              onClick={() => onSelectTable(table)}
                              aria-current={isTableActive ? "true" : undefined}
                              style={{ paddingLeft: 12, height: 28 }}
                            >
                              <span
                                className="blob-status-dot valid"
                                style={{ background: "var(--accent)" }}
                              />
                              <span className="blob-name" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                                {table}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 11, padding: "4px 12px" }}>
                          No tables found
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "8px 16px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
              Connect your D1 databases to query tables.
            </p>
          </div>
        )}

        <div style={{ padding: "8px 16px" }}>
          <button
            id="connect-table-btn"
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "6px 12px", width: "100%", textAlign: "center" }}
            onClick={() => setIsModalOpen(true)}
          >
            + Connect database
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <form className="modal-container" onSubmit={handleSubmit}>
            <div className="modal-header">
              <span className="modal-title">Connect D1 Database</span>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ color: "var(--danger)", background: "var(--danger-bg)", padding: 8, borderRadius: 6, fontSize: 12 }}>
                {formError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Connection Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. My Prod Analytics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cloudflare Account ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="Hex Account ID"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">D1 Database ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="UUID Database ID"
                value={dbId}
                onChange={(e) => setDbId(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cloudflare API Token</label>
              <input
                type="password"
                className="form-input"
                placeholder="API Token (Read/Write D1)"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}
