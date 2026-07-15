"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SAMPLE_BLOBS } from "@/lib/sample-data";
import { useUser } from "@/hooks/useUser";
import type { ViewMode, Blob } from "@/lib/types";

export default function Home() {
  const { user, logout } = useUser();
  
  const [activeBlobId, setActiveBlobId] = useState<string>(SAMPLE_BLOBS[0].id);
  const [blobs, setBlobs] = useState<Blob[]>(SAMPLE_BLOBS);
  const [view, setView] = useState<ViewMode>("editor");

  // D1 Database integration states
  const [connectedTables, setConnectedTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableContent, setTableContent] = useState<string>("[]");
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Manual save and share state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  // Load shared blob on mount if ?shared=[id] query param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("shared");
    if (sharedId) {
      (async () => {
        try {
          const res = await fetch(`/api/jsonBlob/${sharedId}`);
          if (res.ok) {
            const data = await res.json() as Blob;
            setBlobs((prev) => {
              if (prev.some((b) => b.id === data.id)) {
                return prev.map((b) => (b.id === data.id ? data : b));
              }
              return [data, ...prev];
            });
            setActiveBlobId(data.id);
            setActiveTable(null);
          }
        } catch (e) {
          console.error("Failed to load shared blob:", e);
        }
      })();
    }
  }, []);

  // Attempt to fetch real D1 blobs and tables on load
  const loadDatabaseData = useCallback(async () => {
    setIsDbLoading(true);
    try {
      // 1. Fetch tables list
      const tablesRes = await fetch("/api/tables");
      const tablesData = await tablesRes.json() as any;
      if (tablesData.tables) {
        setConnectedTables(tablesData.tables);
      }

      // 2. Fetch actual blobs list
      const blobsRes = await fetch("/api/jsonBlob");
      const blobsData = await blobsRes.json() as any;
      if (blobsData.blobs && blobsData.blobs.length > 0) {
        // Fetch content of the first blob to select it
        const first = blobsData.blobs[0];
        const detailRes = await fetch(`/api/jsonBlob/${first.id}`);
        const detailData = await detailRes.json() as any;

        // Construct initial list
        const updatedList = blobsData.blobs.map((b: any) =>
          b.id === first.id ? detailData : { ...b, content: "{}" }
        ) as Blob[];
        
        // Merge with shared blob if loaded
        setBlobs((prev) => {
          const sharedBlob = prev.find((b) => !updatedList.some((u) => u.id === b.id));
          return sharedBlob ? [sharedBlob, ...updatedList] : updatedList;
        });
        
        // Keep shared blob selected if it was set on mount
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get("shared");
        if (!sharedId) {
          setActiveBlobId(first.id);
        }
        setActiveTable(null);
      }
    } catch {
      // Keep sample data if local Next dev server is used
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  // Virtual active blob derived from selection (real blob or database table)
  const activeBlob = useMemo(() => {
    if (activeTable) {
      return {
        id: activeTable,
        workspace_id: null,
        name: activeTable,
        content: tableContent,
        created_at: Date.now(),
        updated_at: Date.now(),
        expires_at: null,
      };
    }
    return blobs.find((b) => b.id === activeBlobId) ?? blobs[0] ?? SAMPLE_BLOBS[0];
  }, [activeBlobId, activeTable, blobs, tableContent]);

  // Select a D1 database table
  const handleSelectTable = useCallback(async (tableName: string) => {
    setActiveTable(tableName);
    try {
      const res = await fetch(`/api/tables/${tableName}?limit=100`);
      const data = await res.json() as any;
      if (data.rows) {
        setTableContent(JSON.stringify(data.rows, null, 2));
      } else {
        setTableContent(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setTableContent(JSON.stringify({ error: "Failed to query table: " + (e as Error).message }, null, 2));
    }
  }, []);

  // Select a JSON blob
  const handleSelectBlob = useCallback(async (id: string) => {
    setActiveTable(null);
    setActiveBlobId(id);

    const match = blobs.find((b) => b.id === id);
    // If the blob's content was not fetched yet, retrieve it
    if (match && (!match.content || match.content === "{}")) {
      try {
        const res = await fetch(`/api/jsonBlob/${id}`);
        const data = await res.json() as Blob;
        setBlobs((prev) => prev.map((b) => (b.id === id ? data : b)));
      } catch {
        // Fallback
      }
    }
  }, [blobs]);

  // Update content only in local state (saving is now manual)
  const updateContent = useCallback(
    (content: string) => {
      if (activeTable) {
        // Table content is read-only representation of database rows
        setTableContent(content);
        return;
      }

      setBlobs((prev) =>
        prev.map((b) =>
          b.id === activeBlobId
            ? { ...b, content, updated_at: Date.now() }
            : b
        )
      );
    },
    [activeBlobId, activeTable]
  );

  const createNewBlob = useCallback(async () => {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
    const newBlob = {
      id,
      workspace_id: null,
      name: "Untitled",
      content: "{}",
      created_at: Date.now(),
      updated_at: Date.now(),
      expires_at: null,
      ai_chat_history: "[]"
    };
    setBlobs((prev) => [newBlob, ...prev]);
    setActiveBlobId(id);
    setActiveTable(null);
    setView("editor");
    try {
      await fetch("/api/jsonBlob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "{}", name: "Untitled" }),
      });
    } catch {/* offline fallback */}
  }, []);

  const updateName = useCallback(
    (name: string) => {
      if (activeTable) return;
      setBlobs((prev) =>
        prev.map((b) => (b.id === activeBlobId ? { ...b, name } : b))
      );
    },
    [activeBlobId, activeTable]
  );

  // Sync AI Chat history to local blob state
  const updateAiChat = useCallback(
    (history: string) => {
      if (activeTable) return;
      setBlobs((prev) =>
        prev.map((b) => (b.id === activeBlobId ? { ...b, ai_chat_history: history } : b))
      );
    },
    [activeBlobId, activeTable]
  );

  // Manual save logic: persists content, name, and AI chat history
  const handleSave = useCallback(async () => {
    if (activeTable) return;
    setSaveStatus("saving");
    try {
      const active = blobs.find((b) => b.id === activeBlobId);
      if (!active) {
        setSaveStatus("error");
        return;
      }

      const res = await fetch(`/api/jsonBlob/${activeBlobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: active.content,
          name: active.name,
          ai_chat_history: active.ai_chat_history ?? "[]"
        }),
      });

      if (res.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [activeBlobId, blobs, activeTable]);

  // Copy shareable link to clipboard
  const handleShare = useCallback(() => {
    if (activeTable) return;
    const shareUrl = `${window.location.origin}/?shared=${activeBlobId}`;
    navigator.clipboard.writeText(shareUrl);
    setSaveStatus("idle");
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 2500);
  }, [activeBlobId, activeTable]);

  return (
    <AppShell
      blobs={blobs}
      activeBlob={activeBlob}
      activeBlobId={activeBlobId}
      view={view}
      onSelectBlob={handleSelectBlob}
      onChangeView={setView}
      onUpdateContent={updateContent}
      onUpdateName={updateName}
      onNewBlob={createNewBlob}
      // D1 props
      connectedTables={connectedTables}
      activeTable={activeTable}
      onSelectTable={handleSelectTable}
      onConnectDb={loadDatabaseData}
      isDbLoading={isDbLoading}
      // Save props
      onSave={handleSave}
      saveStatus={saveStatus}
      onUpdateAiChat={updateAiChat}
      // Share props
      onShare={handleShare}
      shareStatus={shareStatus}
      // User/Auth props
      user={user}
      onLogout={logout}
    />
  );
}
