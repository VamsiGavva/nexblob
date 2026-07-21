"use client";
import { useState, useEffect } from "react";
import type { ViewMode } from "@/lib/types";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "table", label: "Table" },
  { id: "raw", label: "Raw" },
  { id: "sql", label: "SQL" },
  { id: "chart", label: "Chart" },
  { id: "diff", label: "Diff" },
  { id: "ai_page", label: "AI Specialist" },
];

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

interface TopBarProps {
  blobName: string;
  view: ViewMode;
  isValid: boolean;
  onChangeView: (v: ViewMode) => void;
  onUpdateName: (name: string) => void;
  // Export prop
  onExport?: (format: "json" | "csv" | "yaml" | "tsv") => void;
  // Save props
  onSave?: () => void;
  saveStatus?: "idle" | "saving" | "success" | "error";
  isReadOnly?: boolean;
  // Share props
  onShare?: () => void;
  shareStatus?: "idle" | "copied";
  // User/Auth props
  user?: User | null;
  onLogout?: () => void;
}

export function TopBar({
  blobName, view, isValid, onChangeView, onUpdateName, onExport,
  onSave, saveStatus = "idle", isReadOnly = false,
  onShare, shareStatus = "idle",
  user, onLogout
}: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(blobName);
  const [exportOpen, setExportOpen] = useState(false);

  // Sync internal name state when active blob name changes
  useEffect(() => {
    setNameValue(blobName);
  }, [blobName]);

  const commitName = () => {
    setEditing(false);
    if (nameValue.trim() && nameValue.trim() !== blobName) {
      onUpdateName(nameValue.trim());
    }
  };

  return (
    <header className="top-bar" role="banner">
      <div className="breadcrumb">
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
          {isReadOnly ? "Database Table" : "My Workspace"}
        </span>
        <span className="breadcrumb-sep">/</span>
        {editing && !isReadOnly ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditing(false); }}
            style={{
              background: "var(--surface-sunken)", border: "1px solid var(--accent)",
              borderRadius: "var(--radius)", padding: "4px 8px",
              outline: "none", fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-body)",
              width: 180,
            }}
            id="blob-name-input"
            aria-label="Blob name"
          />
        ) : (
          <button
            className="breadcrumb-current"
            onClick={() => { if (!isReadOnly) { setEditing(true); setNameValue(blobName); } }}
            style={{
              background: "none", border: "none",
              cursor: isReadOnly ? "default" : "text",
              fontSize: 14, fontWeight: 600, color: "var(--text-primary)"
            }}
            id="blob-name-display"
            disabled={isReadOnly}
            aria-label={isReadOnly ? `Table: ${blobName}` : `Rename blob: ${blobName}`}
          >
            {blobName}
          </button>
        )}
        <span
          className={`badge ${isValid ? "badge-success" : "badge-warning"}`}
          style={{ fontSize: 10, padding: "2px 6px", height: "fit-content" }}
        >
          {isValid ? "valid" : "error"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {view === "diff" || view === "postman" ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{view === "diff" ? "🔀 Diff Check" : "🚀 Postman API Client"}</span>
          </div>
        ) : (
          <nav className="view-pills" aria-label="View switcher" role="tablist">
            {VIEWS.filter(v => v.id !== "diff" && v.id !== "postman").map(({ id, label }) => (
              <button
                key={id}
                id={`view-pill-${id}`}
                role="tab"
                aria-selected={view === id}
                className={`view-pill ${view === id ? "active" : ""}`}
                onClick={() => onChangeView(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Auth-conditional topbar options */}
        {!isReadOnly && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user === null ? (
              /* Signed Out -> Render Sign In with Google Button */
              <a
                id="google-login-btn"
                href="/api/auth/google"
                className="btn btn-primary"
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                  color: "#fff",
                  background: "linear-gradient(135deg, #4285F4 0%, #357ae8 100%)",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(66, 133, 244, 0.25)"
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Sign In
              </a>
            ) : user === undefined ? (
              /* Loading State -> Loading placeholder */
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</span>
            ) : (
              /* Signed In -> Render Share, Save, and Profile */
              <>
                {onExport && (
                  <div style={{ position: "relative" }}>
                    <button
                      id="export-blob-btn"
                      className="btn btn-ghost"
                      onClick={() => setExportOpen((prev) => !prev)}
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <span>📥</span>
                      Export
                    </button>

                    {exportOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          right: 0,
                          marginTop: 6,
                          background: "var(--surface)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius)",
                          boxShadow: "var(--shadow-md)",
                          padding: "4px 0",
                          zIndex: 1000,
                          minWidth: 120
                        }}
                      >
                        {(["json", "csv", "yaml", "tsv"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            id={`export-opt-${fmt}`}
                            onClick={() => {
                              onExport(fmt);
                              setExportOpen(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "6px 12px",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 500,
                              color: "var(--text-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <span>.{fmt.toUpperCase()}</span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Save</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {onShare && (
                  <button
                    id="share-blob-btn"
                    className="btn btn-ghost"
                    onClick={onShare}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <span>🔗</span>
                    {shareStatus === "copied" ? "Copied!" : "Share"}
                  </button>
                )}

                {onSave && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {saveStatus === "saving" && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)", transition: "all 0.2s" }}>
                        Saving…
                      </span>
                    )}
                    {saveStatus === "success" && (
                      <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 500, transition: "all 0.2s" }}>
                        Saved! ✓
                      </span>
                    )}
                    {saveStatus === "error" && (
                      <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 500, transition: "all 0.2s" }}>
                        Error! ⚠
                      </span>
                    )}
                    <button
                      id="save-blob-btn"
                      className="btn btn-primary"
                      onClick={onSave}
                      disabled={saveStatus === "saving"}
                      style={{
                        fontSize: 12,
                        padding: "6px 14px",
                        fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(108, 92, 231, 0.25)"
                      }}
                    >
                      Save
                    </button>
                  </div>
                )}

                <div style={{ height: 20, width: 1, backgroundColor: "var(--border)" }} />

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name ?? "User Profile"}
                      style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      backgroundColor: "var(--accent)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: "bold"
                    }}>
                      {(user.name || user.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  {onLogout && (
                    <button
                      className="btn btn-ghost"
                      onClick={onLogout}
                      style={{ fontSize: 11, padding: "4px 8px", color: "var(--text-muted)" }}
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
