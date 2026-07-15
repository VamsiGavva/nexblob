"use client";
import { useState, useEffect } from "react";
import type { ViewMode } from "@/lib/types";
import { useUser } from "@/hooks/useUser";

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
}

export function TopBar({
  blobName, view, isValid, onChangeView, onUpdateName,
  onSave, saveStatus = "idle", isReadOnly = false
}: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(blobName);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout } = useUser();

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

  const handleLoginClick = () => {
    window.location.href = "/api/auth/google";
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

        {/* Auth + Save area */}
        {!isReadOnly && !loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user ? (
              <>
                {/* Save status text */}
                {saveStatus === "saving" && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span>
                )}
                {saveStatus === "success" && (
                  <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 500 }}>Saved! ✓</span>
                )}
                {saveStatus === "error" && (
                  <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 500 }}>Error! ⚠</span>
                )}

                {/* Save button */}
                {onSave && (
                  <button
                    id="save-blob-btn"
                    className="btn btn-primary"
                    onClick={onSave}
                    disabled={saveStatus === "saving"}
                    style={{ fontSize: 12, padding: "6px 14px", fontWeight: 600, boxShadow: "0 2px 8px rgba(108, 92, 231, 0.25)" }}
                  >
                    Save
                  </button>
                )}

                {/* User avatar + dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    id="user-avatar-btn"
                    onClick={() => setMenuOpen((p) => !p)}
                    title={user.name ?? user.email}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      border: "2px solid var(--accent)",
                      padding: 0, cursor: "pointer", overflow: "hidden",
                      background: "var(--surface)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label="User menu"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name ?? user.email}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </button>

                  {menuOpen && (
                    <div
                      style={{
                        position: "absolute", top: "calc(100% + 8px)", right: 0,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)",
                        minWidth: 200, zIndex: 999, padding: "6px 0",
                      }}
                    >
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {user.name ?? "User"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        id="logout-btn"
                        onClick={async () => { setMenuOpen(false); await logout(); }}
                        style={{
                          width: "100%", textAlign: "left", padding: "8px 16px",
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 13, color: "var(--warning)", fontWeight: 500,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,100,100,0.08)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Not logged in → show Sign in button instead of Save */
              <button
                id="sign-in-btn"
                onClick={handleLoginClick}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "var(--shadow-sm)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
