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

interface TopBarProps {
  blobName: string;
  view: ViewMode;
  isValid: boolean;
  onChangeView: (v: ViewMode) => void;
  onUpdateName: (name: string) => void;
  // Save props
  onSave?: () => void;
  saveStatus?: "idle" | "saving" | "success" | "error";
  isReadOnly?: boolean;
  // Share props
  onShare?: () => void;
  shareStatus?: "idle" | "copied";
}

export function TopBar({
  blobName, view, isValid, onChangeView, onUpdateName,
  onSave, saveStatus = "idle", isReadOnly = false,
  onShare, shareStatus = "idle"
}: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(blobName);

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
        <nav className="view-pills" aria-label="View switcher" role="tablist">
          {VIEWS.map(({ id, label }) => (
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

        {/* Share & Save buttons and status indicators */}
        {!isReadOnly && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          </div>
        )}
      </div>
    </header>
  );
}
