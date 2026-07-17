"use client";
import { useState, useMemo, useEffect } from "react";
import { IconRail } from "./IconRail";
import { FileSidebar } from "./FileSidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { EditorView, TreePanel } from "@/components/views/EditorView";
import { TableViewComponent } from "@/components/views/TableViewComponent";
import { RawView } from "@/components/views/RawView";
import { ChartView } from "@/components/views/ChartView";
import { DiffSidePanel, DiffInputView, alignDiffs } from "@/components/views/DiffView";
import { AiPageView } from "@/components/views/AiPageView";
import dynamic from "next/dynamic";
import { parseJSON, formatJSON } from "@/lib/json-utils";
import type { Blob, ViewMode, D1Connection } from "@/lib/types";
import type { User } from "@/hooks/useUser";

// SqlView must be no-SSR because alasql only works in the browser
const SqlView = dynamic(
  () => import("@/components/views/SqlView").then((m) => m.SqlView),
  { ssr: false, loading: () => <div style={{ padding: 32, color: "var(--text-muted)" }}>Loading SQL engine…</div> }
);

interface AppShellProps {
  blobs: Blob[];
  activeBlob: Blob;
  activeBlobId: string;
  view: ViewMode;
  onSelectBlob: (id: string) => void;
  onChangeView: (v: ViewMode) => void;
  onUpdateContent: (content: string) => void;
  onUpdateName: (name: string) => void;
  onNewBlob: () => void;
  // D1 DB props
  connections: D1Connection[];
  activeConnectionId: string | null;
  onSelectConnection: (id: string | null) => void;
  onAddConnection: (name: string, accountId: string, dbId: string, apiToken: string) => Promise<void>;
  onDeleteConnection: (id: string) => Promise<void>;
  connectedTables: string[];
  activeTable: string | null;
  onSelectTable: (name: string) => void;
  isDbLoading: boolean;
  dbError: string | null;
  // Save props
  onSave: () => void;
  saveStatus: "idle" | "saving" | "success" | "error";
  onUpdateAiChat: (history: string) => void;
  // Share props
  onShare: () => void;
  shareStatus: "idle" | "copied";
  // User/Auth props
  user: User | null | undefined;
  onLogout: () => void;
}

export function AppShell({
  blobs, activeBlob, activeBlobId, view,
  onSelectBlob, onChangeView, onUpdateContent, onUpdateName, onNewBlob,
  connections, activeConnectionId, onSelectConnection, onAddConnection, onDeleteConnection,
  connectedTables, activeTable, onSelectTable, isDbLoading, dbError,
  onSave, saveStatus, onUpdateAiChat,
  onShare, shareStatus,
  user, onLogout
}: AppShellProps) {
  const parsed = parseJSON(activeBlob.content);

  // Side-by-side Diff state
  const [diffCompareContent, setDiffCompareContent] = useState("");
  const [diffShowDiff, setDiffShowDiff] = useState(false);

  // SQL Query editor states, persisted across panel unmounts
  const defaultSqlQuery = useMemo(() => {
    if (activeConnectionId) {
      if (activeTable) {
        return `SELECT * FROM ${activeTable} LIMIT 10`;
      }
      return "SELECT * FROM sqlite_master WHERE type='table'";
    }
    return "SELECT * FROM ? LIMIT 10";
  }, [activeConnectionId, activeTable]);

  const [sqlQuery, setSqlQuery] = useState(defaultSqlQuery);
  const [prevDefaultSqlQuery, setPrevDefaultSqlQuery] = useState(defaultSqlQuery);

  // Sync default query when connection or selected table changes, preserving custom query modifications
  useEffect(() => {
    if (sqlQuery === prevDefaultSqlQuery) {
      setSqlQuery(defaultSqlQuery);
    }
    setPrevDefaultSqlQuery(defaultSqlQuery);
  }, [defaultSqlQuery]);

  // Reset diff state when active document changes
  useEffect(() => {
    setDiffCompareContent("");
    setDiffShowDiff(false);
  }, [activeBlobId, activeTable]);

  // Standardize/Format JSON A (Active JSON)
  const activeFormatted = useMemo(() => {
    if (parsed.data) {
      try {
        return formatJSON(parsed.data);
      } catch {
        return activeBlob.content;
      }
    }
    return activeBlob.content;
  }, [activeBlob.content, parsed.data]);

  // Standardize/Format JSON B (Compared JSON)
  const compareFormatted = useMemo(() => {
    if (!diffCompareContent) return "";
    try {
      const obj = JSON.parse(diffCompareContent);
      return formatJSON(obj);
    } catch {
      return diffCompareContent;
    }
  }, [diffCompareContent]);

  // Align lines for side-by-side display
  const { leftLines, rightLines } = useMemo(() => {
    if (!diffShowDiff) return { leftLines: [], rightLines: [] };
    return alignDiffs(activeFormatted, compareFormatted);
  }, [diffShowDiff, activeFormatted, compareFormatted]);

  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    leftLines.forEach((line) => {
      if (line.type === "removed") removed++;
    });
    rightLines.forEach((line) => {
      if (line.type === "added") added++;
    });
    return { added, removed };
  }, [leftLines, rightLines]);

  return (
    <div className="app-shell">
      <IconRail
        activeView={view}
        onChangeView={onChangeView}
      />
      <FileSidebar
        blobs={blobs}
        activeBlobId={activeBlobId}
        onSelectBlob={onSelectBlob}
        onNewBlob={onNewBlob}
        // D1 Props
        connections={connections}
        activeConnectionId={activeConnectionId}
        onSelectConnection={onSelectConnection}
        onAddConnection={onAddConnection}
        onDeleteConnection={onDeleteConnection}
        connectedTables={connectedTables}
        activeTable={activeTable}
        onSelectTable={onSelectTable}
        isDbLoading={isDbLoading}
        dbError={dbError}
      />
      <main className="main-area">
        <TopBar
          blobName={activeBlob.name}
          view={view}
          onChangeView={onChangeView}
          onUpdateName={onUpdateName}
          isValid={parsed.error === null}
          onSave={onSave}
          saveStatus={saveStatus}
          isReadOnly={activeTable !== null}
          onShare={onShare}
          shareStatus={shareStatus}
          user={user}
          onLogout={onLogout}
        />
        <div className="content-area" style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
          {/* Render Diff view when showDiff is true */}
          {view === "diff" && diffShowDiff ? (
            <>
              {/* Left Pane: JSON A with red highlights */}
              <div style={{ flex: 1, minWidth: 0, height: "100%", borderRight: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <DiffSidePanel
                  title="Original JSON (A)"
                  lines={leftLines}
                  highlightType="removed"
                />
              </div>

              {/* Right Pane: JSON B with green highlights */}
              <div style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <DiffSidePanel
                  title="Modified JSON (B)"
                  lines={rightLines}
                  highlightType="added"
                  stats={diffStats}
                  onModify={() => setDiffShowDiff(false)}
                />
              </div>
            </>
          ) : (
            <>
              {/* Standard split screen left pane: raw CodeMirror Editor (always visible except in diff-showing mode) */}
              <div style={{ flex: 1, minWidth: 0, height: "100%", borderRight: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <EditorView
                  content={activeBlob.content}
                  onChange={onUpdateContent}
                  parsed={parsed}
                  isReadOnly={activeTable !== null}
                />
              </div>

              {/* Standard split screen right pane: active panel */}
              <div style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {view === "editor" && <TreePanel parsed={parsed} />}
                {view === "table" && <TableViewComponent parsed={parsed} />}
                {view === "raw" && <RawView content={activeBlob.content} parsed={parsed} />}
                {view === "sql" && (
                  <SqlView
                    parsed={parsed}
                    activeConnectionId={activeConnectionId}
                    activeTable={activeTable}
                    query={sqlQuery}
                    setQuery={setSqlQuery}
                    defaultQuery={defaultSqlQuery}
                  />
                )}
                {view === "chart" && <ChartView parsed={parsed} />}
                {view === "diff" && (
                  <DiffInputView
                    compareContent={diffCompareContent}
                    onChange={setDiffCompareContent}
                    onCompare={() => setDiffShowDiff(true)}
                    onClear={() => setDiffCompareContent("")}
                  />
                )}
                {view === "ai_page" && (
                  <AiPageView
                    content={activeBlob.content}
                    parsed={parsed}
                    aiChatHistory={activeBlob.ai_chat_history}
                    onUpdateAiChat={onUpdateAiChat}
                    activeTable={activeTable}
                    activeConnectionId={activeConnectionId}
                  />
                )}
              </div>
            </>
          )}
        </div>
        <StatusBar parsed={parsed} onExplain={() => onChangeView("ai_page")} />
      </main>
    </div>
  );
}
