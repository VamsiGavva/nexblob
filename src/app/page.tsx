"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SAMPLE_BLOBS } from "@/lib/sample-data";
import { useUser } from "@/hooks/useUser";
import type { ViewMode, Blob, D1Connection } from "@/lib/types";

export default function Home() {
  const { user, logout } = useUser();
  
  const [activeBlobId, setActiveBlobId] = useState<string>(SAMPLE_BLOBS[0].id);
  const [blobs, setBlobs] = useState<Blob[]>(SAMPLE_BLOBS);
  const [view, setView] = useState<ViewMode>("editor");

  // D1 Database integration states
  const [connections, setConnections] = useState<D1Connection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [connectedTables, setConnectedTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableContent, setTableContent] = useState<string>("[]");
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [tableChatHistories, setTableChatHistories] = useState<Record<string, string>>({});

  // Manual save and share state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [sharedParam, setSharedParam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSharedParam(params.get("shared"));
    }
  }, []);

  // Fetch connections list
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json() as any;
        if (data.connections) {
          setConnections(data.connections);
        }
      }
    } catch (e) {
      console.error("Failed to fetch D1 connections:", e);
    }
  }, []);

  // Fetch tables when active connection changes
  const fetchTables = useCallback(async (connId: string) => {
    setIsDbLoading(true);
    setDbError(null);
    setConnectedTables([]);
    setActiveTable(null);
    try {
      const res = await fetch(`/api/connections/${connId}/tables?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.tables) {
          setConnectedTables(data.tables);
        } else {
          setDbError("Invalid response format");
        }
      } else {
        let errorMsg = "Failed to load tables";
        try {
          const data = await res.json() as any;
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = await res.text() || errorMsg;
        }
        setDbError(errorMsg);
      }
    } catch (e: any) {
      console.error("Failed to fetch D1 tables:", e);
      setDbError(e.message || "Failed to fetch tables");
    } finally {
      setIsDbLoading(false);
    }
  }, []);

  const handleSelectConnection = useCallback((id: string | null) => {
    setActiveConnectionId(id);
    setDbError(null);
    if (id) {
      fetchTables(id);
    } else {
      setConnectedTables([]);
      setActiveTable(null);
    }
  }, [fetchTables]);

  const handleAddConnection = useCallback(async (name: string, accountId: string, dbId: string, apiToken: string) => {
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        account_id: accountId,
        database_id: dbId,
        api_token: apiToken
      })
    });
    if (!res.ok) {
      let errorMsg = "Failed to add connection";
      try {
        const data = await res.json() as any;
        errorMsg = data.error || errorMsg;
      } catch {
        errorMsg = `Server error (${res.status}): ${await res.text().catch(() => "unknown")}`;
      }
      throw new Error(errorMsg);
    }
    await fetchConnections();
  }, [fetchConnections]);


  const handleDeleteConnection = useCallback(async (id: string) => {
    const res = await fetch(`/api/connections/${id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      if (activeConnectionId === id) {
        setActiveConnectionId(null);
        setConnectedTables([]);
        setActiveTable(null);
      }
      await fetchConnections();
    }
  }, [activeConnectionId, fetchConnections]);

  const handleDeleteBlob = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jsonBlob/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete blob:", err);
    }

    setBlobs((prev) => {
      const nextBlobs = prev.filter((b) => b.id !== id);
      if (activeBlobId === id) {
        if (nextBlobs.length > 0) {
          setActiveBlobId(nextBlobs[0].id);
        } else {
          const newId = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
          const newBlob: Blob = {
            id: newId,
            workspace_id: null,
            name: "Untitled",
            content: "{}",
            created_at: Date.now(),
            updated_at: Date.now(),
            expires_at: null,
            ai_chat_history: "[]"
          };
          setActiveBlobId(newId);
          return [newBlob];
        }
      }
      return nextBlobs;
    });
  }, [activeBlobId]);

  // Attempt to fetch real D1 blobs on load
  const loadDatabaseData = useCallback(async () => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const sharedId = params?.get("shared");

    try {
      const blobsRes = await fetch("/api/jsonBlob");
      const blobsData = await blobsRes.json() as any;
      const userWorkspaceBlobs: any[] = blobsData.blobs ?? [];

      if (sharedId) {
        // Fetch shared blob detail
        let sharedBlob: Blob | null = null;
        try {
          const res = await fetch(`/api/jsonBlob/${sharedId}`);
          if (res.ok) {
            sharedBlob = await res.json() as Blob;
          }
        } catch (e) {
          console.error("Failed to load shared blob:", e);
        }

        if (sharedBlob) {
          const isOwner = userWorkspaceBlobs.some((b: any) => b.id === sharedId);
          if (isOwner && userWorkspaceBlobs.length > 0) {
            // Same logged-in owner: show full workspace list with shared blob active
            const updatedList = userWorkspaceBlobs.map((b: any) =>
              b.id === sharedId ? sharedBlob : { ...b, content: "{}" }
            ) as Blob[];
            setBlobs(updatedList);
            setActiveBlobId(sharedId);
          } else {
            // Different user / recipient: show shared blob along with recipient's own saved JSONs
            const recipientWorkspace = userWorkspaceBlobs
              .filter((b: any) => b.id !== sharedId)
              .map((b: any) => ({ ...b, content: "{}" }));
            setBlobs([sharedBlob, ...recipientWorkspace]);
            setActiveBlobId(sharedBlob.id);
          }
          setActiveConnectionId(null);
          setActiveTable(null);
          return;
        }
      }

      // Normal mode: load user's workspace blobs
      if (userWorkspaceBlobs.length > 0) {
        const first = userWorkspaceBlobs[0];
        const detailRes = await fetch(`/api/jsonBlob/${first.id}`);
        const detailData = await detailRes.json() as any;

        const updatedList = userWorkspaceBlobs.map((b: any) =>
          b.id === first.id ? detailData : { ...b, content: "{}" }
        ) as Blob[];
        
        setBlobs(updatedList);
        setActiveBlobId(first.id);
        setActiveConnectionId(null);
        setActiveTable(null);
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  useEffect(() => {
    if (user) {
      fetchConnections();
    } else {
      setConnections([]);
      setActiveConnectionId(null);
      setConnectedTables([]);
      setActiveTable(null);
    }
  }, [user, fetchConnections]);

  // Virtual active blob derived from selection (real blob or database table)
  const activeBlob = useMemo(() => {
    if (activeTable) {
      return {
        id: activeTable,
        workspace_id: null,
        name: activeTable,
        content: tableContent,
        ai_chat_history: tableChatHistories[activeTable] ?? "[]",
        created_at: Date.now(),
        updated_at: Date.now(),
        expires_at: null,
      };
    }
    return blobs.find((b) => b.id === activeBlobId) ?? blobs[0] ?? SAMPLE_BLOBS[0];
  }, [activeBlobId, activeTable, blobs, tableContent, tableChatHistories]);

  // Select a D1 database table
  const handleSelectTable = useCallback(async (tableName: string) => {
    if (!activeConnectionId) return;
    setActiveTable(tableName);
    try {
      const res = await fetch(`/api/connections/${activeConnectionId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `SELECT * FROM ${tableName} LIMIT 100`
        }),
      });
      const data = await res.json() as any;
      if (data.rows) {
        setTableContent(JSON.stringify(data.rows, null, 2));
      } else {
        setTableContent(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setTableContent(JSON.stringify({ error: "Failed to query table: " + (e as Error).message }, null, 2));
    }
  }, [activeConnectionId]);

  // Select a JSON blob
  const handleSelectBlob = useCallback(async (id: string) => {
    setActiveConnectionId(null);
    setActiveTable(null);
    setActiveBlobId(id);

    const match = blobs.find((b) => b.id === id);
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

  const createBlobWithContent = useCallback(async (content = "{}", name = "Untitled") => {
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
    const newBlob = {
      id,
      workspace_id: null,
      name,
      content,
      created_at: Date.now(),
      updated_at: Date.now(),
      expires_at: null,
      ai_chat_history: "[]"
    };
    setBlobs((prev) => [newBlob, ...prev.filter((b) => b.id !== id)]);
    setActiveBlobId(id);
    setActiveConnectionId(null);
    setActiveTable(null);
    setView("editor");
    try {
      const res = await fetch("/api/jsonBlob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content, name }),
      });
      if (res.ok) {
        const savedBlob = await res.json() as Blob;
        setBlobs((prev) => prev.map((b) => (b.id === id ? { ...savedBlob, name: b.name, content: b.content } : b)));
        setActiveBlobId(savedBlob.id);
      }
    } catch {/* offline fallback */}
  }, []);

  const createNewBlob = useCallback(() => createBlobWithContent("{}", "Untitled"), [createBlobWithContent]);

  const updateName = useCallback(
    (name: string) => {
      if (activeTable) return;
      setBlobs((prev) =>
        prev.map((b) => (b.id === activeBlobId ? { ...b, name } : b))
      );
    },
    [activeBlobId, activeTable]
  );

  // Sync AI Chat history to local blob state with background auto-save
  const updateAiChat = useCallback(
    (history: string) => {
      if (activeTable) {
        setTableChatHistories((prev) => ({ ...prev, [activeTable]: history }));
        return;
      }
      setBlobs((prev) =>
        prev.map((b) => (b.id === activeBlobId ? { ...b, ai_chat_history: history } : b))
      );
      // Auto-save chat history to D1 in the background so it is not lost on reload or tab switch!
      fetch(`/api/jsonBlob/${activeBlobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_chat_history: history })
      }).catch((err) => console.error("Failed to auto-save AI chat history:", err));
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
        // If recipient saved a shared blob, reload workspace list so it remains in their sidebar
        try {
          const blobsRes = await fetch("/api/jsonBlob");
          const blobsData = await blobsRes.json() as any;
          if (blobsData.blobs) {
            setBlobs((prev) => {
              const updatedMap = new Map(prev.map((b) => [b.id, b]));
              blobsData.blobs.forEach((b: any) => {
                if (!updatedMap.has(b.id)) {
                  updatedMap.set(b.id, { ...b, content: "{}" });
                }
              });
              return Array.from(updatedMap.values());
            });
          }
        } catch {}
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [activeBlobId, blobs, activeTable]);

  // Copy shareable link to clipboard and ensure blob is saved to database
  const handleShare = useCallback(async () => {
    if (activeTable) return;
    const active = blobs.find((b) => b.id === activeBlobId);
    if (active) {
      setSaveStatus("saving");
      try {
        await fetch(`/api/jsonBlob/${activeBlobId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: active.content,
            name: active.name,
            ai_chat_history: active.ai_chat_history ?? "[]"
          }),
        });
        setSaveStatus("success");
      } catch {
        setSaveStatus("error");
      }
    }
    const shareUrl = `${window.location.origin}/?shared=${activeBlobId}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    }
    setShareStatus("copied");
    setTimeout(() => {
      setShareStatus("idle");
      setSaveStatus("idle");
    }, 2500);
  }, [activeBlobId, blobs, activeTable]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
      {sharedParam && user === null && (
        <div
          id="shared-auth-modal"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 17, 26, 0.88)",
            backdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center"
          }}
        >
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "36px 32px",
            maxWidth: 440,
            width: "100%",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(66, 133, 244, 0.15)", color: "#4285F4",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, marginBottom: 4
            }}>
              🔒
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Sign In Required
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              You have been invited to view a shared JSON document. Please sign in to view this document.
            </p>
            <a
              id="shared-login-btn"
              href="/api/auth/google"
              className="btn btn-primary"
              style={{
                fontSize: 13,
                padding: "10px 22px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                color: "#fff",
                background: "linear-gradient(135deg, #4285F4 0%, #357ae8 100%)",
                border: "none",
                borderRadius: 8,
                boxShadow: "0 4px 14px rgba(66, 133, 244, 0.35)",
                marginTop: 8
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Sign In with Google
            </a>
          </div>
        </div>
      )}
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
        onDeleteBlob={handleDeleteBlob}
        onCreateBlobWithContent={createBlobWithContent}
        // D1 connection props
        connections={connections}
        activeConnectionId={activeConnectionId}
        onSelectConnection={handleSelectConnection}
        onAddConnection={handleAddConnection}
        onDeleteConnection={handleDeleteConnection}
        connectedTables={connectedTables}
        activeTable={activeTable}
        onSelectTable={handleSelectTable}
        isDbLoading={isDbLoading}
        dbError={dbError}
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
    </div>
  );
}
