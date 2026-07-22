"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { parseJSON, formatJSON } from "@/lib/json-utils";

interface PostmanViewProps {
  activeBlobContent?: string;
  onCreateBlobWithContent?: (content: string, name?: string) => void;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface TableRow {
  enabled: boolean;
  key: string;
  value: string;
  description: string;
}

interface RequestDocResponse {
  status: number;
  name: string;
  schema?: string;
}

interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: TableRow[];
  headers: TableRow[];
  body: string;
  description: string;
  responsesDoc: RequestDocResponse[];
  response: {
    status: number;
    statusText: string;
    time: number;
    size: string;
    body: string;
    headers: Record<string, string>;
  } | null;
}

interface Collection {
  id: string;
  name: string;
  requests: RequestItem[];
}

interface OpenTab {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: TableRow[];
  headers: TableRow[];
  body: string;
  description: string;
  responsesDoc: RequestDocResponse[];
  response: RequestItem["response"] | { error: string } | null;
  isDirty: boolean;
  activeReqTab: "params" | "authorization" | "headers" | "body" | "pre-script" | "tests" | "settings";
  activeResTab: "body" | "cookies" | "headers" | "tests" | "ai_troubleshoot";
  prettyFormat: boolean;
  aiTroubleshootResult?: string;
  isTroubleshooting?: boolean;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#10b981",
  POST: "#f59e0b",
  PUT: "#3b82f6",
  DELETE: "#ef4444",
  PATCH: "#8b5cf6",
};

// Helper: Highlights syntax of formatted JSON
function highlightJSON(jsonStr: string) {
  try {
    const obj = JSON.parse(jsonStr);
    const pretty = JSON.stringify(obj, null, 2);
    const lines = pretty.split("\n");
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "12.5px", lineHeight: "1.7", overflowX: "auto" }}>
        {lines.map((line, idx) => {
          // Split indent from content so whiteSpace:pre handles it
          const indentMatch = line.match(/^(\s*)([\s\S]*)$/);
          const indent = indentMatch?.[1] ?? "";
          const content = indentMatch?.[2] ?? line;

          let rendered: React.ReactNode;

          // Key-value pair:  "key": value
          const kvMatch = content.match(/^("(?:[^"\\]|\\.)*")\s*:\s*([\s\S]*)$/);
          if (kvMatch) {
            const key = kvMatch[1];
            const rest = kvMatch[2].trimEnd();
            let valNode: React.ReactNode;

            if (rest === "{" || rest === "[" || rest === "{," || rest === "[,") {
              valNode = <span style={{ color: "#8b949e" }}>{rest}</span>;
            } else if (rest.startsWith('"')) {
              valNode = <span style={{ color: "#ffab70" }}>{rest}</span>;
            } else if (rest === "true" || rest === "true,") {
              valNode = <span style={{ color: "#79c0ff" }}>{rest}</span>;
            } else if (rest === "false" || rest === "false,") {
              valNode = <span style={{ color: "#ff7b72" }}>{rest}</span>;
            } else if (rest === "null" || rest === "null,") {
              valNode = <span style={{ color: "#8b949e", fontStyle: "italic" }}>{rest}</span>;
            } else if (/^-?\d[\d.eE+\-]*,?$/.test(rest)) {
              valNode = <span style={{ color: "#79c0ff" }}>{rest}</span>;
            } else {
              valNode = <span style={{ color: "#e1e4e8" }}>{rest}</span>;
            }

            rendered = (
              <>
                <span style={{ color: "#a5d6ff" }}>{key}</span>
                <span style={{ color: "#c9d1d9" }}>: </span>
                {valNode}
              </>
            );
          } else {
            // Structural tokens, standalone values, closing brackets
            const trimmed = content.trimEnd();
            if (trimmed === "{" || trimmed === "}" || trimmed === "[" || trimmed === "]"
              || trimmed === "}," || trimmed === "]," || trimmed === "{," || trimmed === "[,") {
              rendered = <span style={{ color: "#8b949e" }}>{trimmed}</span>;
            } else if (trimmed.startsWith('"')) {
              // Standalone string value (e.g. in array)
              rendered = <span style={{ color: "#ffab70" }}>{trimmed}</span>;
            } else if (/^-?\d[\d.eE+\-]*,?$/.test(trimmed)) {
              rendered = <span style={{ color: "#79c0ff" }}>{trimmed}</span>;
            } else if (trimmed === "true" || trimmed === "true," || trimmed === "false" || trimmed === "false,") {
              rendered = <span style={{ color: trimmed.startsWith("t") ? "#79c0ff" : "#ff7b72" }}>{trimmed}</span>;
            } else if (trimmed === "null" || trimmed === "null,") {
              rendered = <span style={{ color: "#8b949e", fontStyle: "italic" }}>{trimmed}</span>;
            } else {
              rendered = <span style={{ color: "#c9d1d9" }}>{trimmed}</span>;
            }
          }

          return (
            <div key={idx} style={{ display: "flex", minHeight: "20px" }}>
              {/* Line number gutter */}
              <span style={{
                minWidth: 36,
                color: "#484f58",
                userSelect: "none",
                textAlign: "right",
                paddingRight: 12,
                fontSize: "11px",
                borderRight: "1px solid #21262d",
                marginRight: 12,
                flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              {/* Line content — whiteSpace:pre preserves indent spaces */}
              <span style={{ whiteSpace: "pre", color: "#c9d1d9" }}>
                {indent}{rendered}
              </span>
            </div>
          );
        })}
      </div>
    );
  } catch {
    // Fallback: plain pre block for non-JSON responses
    return (
      <pre style={{
        fontFamily: "var(--font-mono)",
        fontSize: "12.5px",
        color: "#c9d1d9",
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all"
      }}>{jsonStr}</pre>
    );
  }
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      margin: "12px 0",
      borderRadius: 6,
      border: "1px solid #30363d",
      background: "#0d0e12",
      overflow: "hidden"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 12px",
        background: "rgba(255, 255, 255, 0.05)",
        borderBottom: "1px solid #30363d"
      }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#8b949e", textTransform: "uppercase" }}>
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: "transparent",
            border: "none",
            color: copied ? "#238636" : "#8b949e",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        padding: 12,
        margin: 0,
        overflowX: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        color: "#c9d1d9",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap"
      }}>
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function renderInlineCode(text: string) {
  const inlineParts = text.split(/(`[^`]+`)/g);
  return inlineParts.map((subPart, k) => {
    if (subPart.startsWith("`") && subPart.endsWith("`")) {
      return (
        <code key={k} style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          background: "rgba(255, 108, 55, 0.15)",
          color: "#ffab70",
          padding: "2px 5px",
          borderRadius: 4
        }}>
          {subPart.slice(1, -1)}
        </code>
      );
    }
    return subPart;
  });
}

function renderMarkdown(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const match = part.match(/```(\w*)\n([\s\S]*?)```/);
      const lang = match?.[1] || "";
      const code = match?.[2] || part.slice(3, -3);
      return <CodeBlock key={i} lang={lang} code={code} />;
    }

    const lines = part.split("\n");
    return (
      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lines.map((line, j) => {
          let trimmed = line.trim();
          let style: React.CSSProperties = { fontSize: "13px", lineHeight: "1.6", color: "#c9d1d9" };
          
          if (trimmed.startsWith("# ")) {
            return <h1 key={j} style={{ ...style, fontSize: "18px", fontWeight: "bold", margin: "12px 0 6px 0", color: "#f0f6fc" }}>{trimmed.slice(2)}</h1>;
          }
          if (trimmed.startsWith("## ")) {
            return <h2 key={j} style={{ ...style, fontSize: "16px", fontWeight: "bold", margin: "10px 0 6px 0", color: "#f0f6fc" }}>{trimmed.slice(3)}</h2>;
          }
          if (trimmed.startsWith("### ")) {
            return <h3 key={j} style={{ ...style, fontSize: "14px", fontWeight: "bold", margin: "8px 0 4px 0", color: "#f0f6fc" }}>{trimmed.slice(4)}</h3>;
          }
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            return (
              <li key={j} style={{ ...style, marginLeft: 16, listStyleType: "disc" }}>
                {renderInlineCode(trimmed.slice(2))}
              </li>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            const numText = trimmed.replace(/^\d+\.\s/, "");
            return (
              <li key={j} style={{ ...style, marginLeft: 16, listStyleType: "decimal" }}>
                {renderInlineCode(numText)}
              </li>
            );
          }

          return <p key={j} style={{ ...style, margin: "2px 0" }}>{renderInlineCode(line)}</p>;
        })}
      </div>
    );
  });
}

export function PostmanView({ activeBlobContent = "{}", onCreateBlobWithContent }: PostmanViewProps) {
  // Collections list loaded from localStorage if exists
  const [collections, setCollections] = useState<Collection[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexblob_postman_collections");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("nexblob_postman_collections", JSON.stringify(collections));
  }, [collections]);

  const [saveRequestStatus, setSaveRequestStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Save Request Modal and Context Menu State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveModalReqName, setSaveModalReqName] = useState("");
  const [saveModalFolderId, setSaveModalFolderId] = useState("");
  const [newFolderNameInput, setNewFolderNameInput] = useState("");
  const [activeMenuReq, setActiveMenuReq] = useState<string | null>(null);

  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Search input in sidebar
  const [sidebarSearch, setSidebarSearch] = useState("");

  // Tabs management
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Environment Selector
  const [environment, setEnvironment] = useState<"No Environment" | "Development" | "Staging" | "Production">("No Environment");

  // Documentation toggle
  const [docOpen, setDocOpen] = useState(true);

  // Send request states
  const [isSending, setIsSending] = useState(false);

  // Initialize first tab with a blank default GET request
  useEffect(() => {
    if (tabs.length === 0) {
      const initialTab: OpenTab = {
        id: "new-request-" + Date.now(),
        name: "New Request",
        method: "GET",
        url: "",
        params: [{ enabled: true, key: "", value: "", description: "" }],
        headers: [{ enabled: true, key: "", value: "", description: "" }],
        body: "",
        description: "New Request Builder",
        responsesDoc: [],
        response: null,
        isDirty: false,
        activeReqTab: "params",
        activeResTab: "body",
        prettyFormat: true,
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
  }, [tabs]);

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  // Expand/collapse folder
  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Open a request in a tab (or switch to it if already open)
  const openRequest = (req: RequestItem) => {
    const existing = tabs.find((t) => t.id === req.id);
    if (existing) {
      setActiveTabId(req.id);
    } else {
      const newTab: OpenTab = {
        id: req.id,
        name: req.name,
        method: req.method,
        url: req.url,
        params: JSON.parse(JSON.stringify(req.params)),
        headers: JSON.parse(JSON.stringify(req.headers)),
        body: req.body || (req.method === "POST" || req.method === "PUT" ? activeBlobContent : ""),
        description: req.description,
        responsesDoc: req.responsesDoc,
        response: req.response,
        isDirty: false,
        activeReqTab: req.method === "GET" ? "params" : "body",
        activeResTab: "body",
        prettyFormat: true,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(req.id);
    }
  };

  // Create a new blank tab
  const createNewTab = () => {
    const newId = `new-request-${Date.now()}`;
    const newTab: OpenTab = {
      id: newId,
      name: "New Request",
      method: "GET",
      url: "",
      params: [{ enabled: true, key: "", value: "", description: "" }],
      headers: [{ enabled: true, key: "", value: "", description: "" }],
      body: "",
      description: "An ad-hoc endpoint request builder.",
      responsesDoc: [],
      response: null,
      isDirty: false,
      activeReqTab: "params",
      activeResTab: "body",
      prettyFormat: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close a tab
  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;
    
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);

    if (activeTabId === tabId) {
      if (remaining.length > 0) {
        // Select nearest tab
        const nextIndex = Math.min(index, remaining.length - 1);
        setActiveTabId(remaining[nextIndex].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  // Syncing functions for URL and Query Params
  const updateTabUrl = (url: string) => {
    if (!activeTabId) return;
    
    // Parse query params out of URL
    let queryParams: TableRow[] = [];
    try {
      if (url.includes("?")) {
        const queryString = url.split("?")[1];
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((value, key) => {
          // Check if we already have this parameter in active tab's params list
          const existingParam = activeTab?.params.find(p => p.key === key);
          queryParams.push({
            enabled: existingParam ? existingParam.enabled : true,
            key,
            value,
            description: existingParam ? existingParam.description : ""
          });
        });
      }
    } catch (e) {
      // url parse error, ignore
    }

    // Add one empty row at the end if empty
    if (queryParams.length === 0) {
      queryParams.push({ enabled: true, key: "", value: "", description: "" });
    } else {
      const last = queryParams[queryParams.length - 1];
      if (last.key || last.value) {
        queryParams.push({ enabled: true, key: "", value: "", description: "" });
      }
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, url, params: queryParams, isDirty: true }
          : t
      )
    );
  };

  const updateTabParams = (params: TableRow[]) => {
    if (!activeTabId || !activeTab) return;

    // Update URL string based on enabled params
    let baseUrl = activeTab.url.split("?")[0];
    const enabledParams = params.filter((p) => p.enabled && p.key.trim());
    
    if (enabledParams.length > 0) {
      const urlParams = new URLSearchParams();
      enabledParams.forEach((p) => urlParams.append(p.key.trim(), p.value));
      baseUrl = `${baseUrl}?${urlParams.toString()}`;
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, params, url: baseUrl, isDirty: true }
          : t
      )
    );
  };

  const updateTabField = <K extends keyof OpenTab>(field: K, value: OpenTab[K]) => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, [field]: value, isDirty: true }
          : t
      )
    );
  };

  // Perform Request Send — uses server-side proxy to avoid CORS issues
  const handleSend = async () => {
    if (!activeTab || !activeTabId) return;

    const rawUrl = activeTab.url.trim();
    if (!rawUrl) {
      alert("Please enter a request URL.");
      return;
    }
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      alert("URL must start with http:// or https://");
      return;
    }

    setIsSending(true);

    // Reset old response and switch to body tab
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, response: null, activeResTab: "body", aiTroubleshootResult: undefined, isTroubleshooting: false } : t
      )
    );

    // Build headers from enabled rows
    const reqHeaders: Record<string, string> = {};
    activeTab.headers.forEach((h) => {
      if (h.enabled && h.key.trim()) {
        reqHeaders[h.key.trim()] = h.value;
      }
    });

    try {
      const proxyRes = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: rawUrl,
          method: activeTab.method,
          headers: reqHeaders,
          body: ["POST", "PUT", "PATCH", "DELETE"].includes(activeTab.method) && activeTab.body.trim()
            ? activeTab.body
            : undefined,
        }),
      });

      const data = await proxyRes.json() as {
        status?: number; statusText?: string; time?: number; size?: string;
        body?: string; headers?: Record<string, string>; error?: string;
      };

      if (!proxyRes.ok || data.error) {
        // Proxy itself failed (not the target API)
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  response: { error: data.error || `Proxy error: ${proxyRes.status}` } as any,
                  activeResTab: "body",
                }
              : t
          )
        );
        return;
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                response: {
                  status: data.status ?? 0,
                  statusText: data.statusText ?? "",
                  time: data.time ?? 0,
                  size: data.size ?? "0 KB",
                  body: data.body ?? "",
                  headers: data.headers ?? {},
                } satisfies RequestItem["response"] & {},
                isDirty: false,
                activeResTab: "body" as const,
              }
            : t
        )
      );
    } catch (e: any) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                response: { error: e?.message || "Network error — could not reach proxy." } as any,
                activeResTab: "body",
              }
            : t
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveResponse = () => {
    if (activeTab?.response && "body" in activeTab.response && activeTab.response.body && onCreateBlobWithContent) {
      let hostname = "API Response";
      try {
        hostname = new URL(activeTab.url).hostname;
      } catch {}

      // Auto-format the JSON body before saving
      let formattedBody = activeTab.response.body;
      try {
        const parsed = JSON.parse(activeTab.response.body);
        formattedBody = JSON.stringify(parsed, null, 2);
      } catch {}

      onCreateBlobWithContent(formattedBody, `Response: ${hostname}`);
    }
  };

  const handleOpenSaveModal = () => {
    if (!activeTab) return;
    setSaveModalReqName(activeTab.name);
    
    // Find activeTab's collection if any
    const existingCol = collections.find(col =>
      col.requests.some(r => r.id === activeTab.id)
    );
    setSaveModalFolderId(existingCol ? existingCol.id : (collections[0]?.id || ""));
    setNewFolderNameInput("");
    setIsSaveModalOpen(true);
  };

  const executeSaveRequest = () => {
    if (!activeTab) return;

    let targetFolderId = saveModalFolderId;
    let updatedCollections = [...collections];

    // Handle new folder creation in save modal
    if (saveModalFolderId === "__new_folder__") {
      const folderName = newFolderNameInput.trim() || "New Folder";
      const newFolderId = `folder-${Date.now()}`;
      const newCol: Collection = {
        id: newFolderId,
        name: folderName,
        requests: []
      };
      updatedCollections.push(newCol);
      targetFolderId = newFolderId;
    }

    const reqName = saveModalReqName.trim() || activeTab.name || "Untitled Request";

    setSaveRequestStatus("saving");

    // Remove request from any other folder first to support folder relocation on Save
    updatedCollections = updatedCollections.map(col => ({
      ...col,
      requests: col.requests.filter(r => r.id !== activeTab.id)
    }));

    // Add/update request in the target folder
    updatedCollections = updatedCollections.map(col => {
      if (col.id === targetFolderId) {
        const newSidebarReq = {
          id: activeTab.id,
          name: reqName,
          method: activeTab.method,
          url: activeTab.url,
          params: activeTab.params.filter(p => p.key),
          headers: activeTab.headers.filter(h => h.key),
          body: activeTab.body,
          description: activeTab.description || "Ad-hoc saved request",
          responsesDoc: activeTab.responsesDoc || [],
          response: null
        };
        return {
          ...col,
          requests: [...col.requests, newSidebarReq]
        };
      }
      return col;
    });

    setCollections(updatedCollections);

    // Update active tab details
    setTabs((prevTabs) =>
      prevTabs.map((t) =>
        t.id === activeTabId
          ? { ...t, name: reqName, isDirty: false }
          : t
      )
    );

    setIsSaveModalOpen(false);
    setSaveRequestStatus("saved");
    setTimeout(() => setSaveRequestStatus("idle"), 1500);
  };

  const handleCreateFolder = () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    const newCol: Collection = {
      id: `folder-${Date.now()}`,
      name: folderName.trim(),
      requests: []
    };
    setCollections(prev => [...prev, newCol]);
  };

  const moveRequestToFolder = (reqId: string, fromColId: string, toColId: string) => {
    if (fromColId === toColId) return;
    
    setCollections(prevCols => {
      const fromCol = prevCols.find(c => c.id === fromColId);
      if (!fromCol) return prevCols;
      
      const reqItem = fromCol.requests.find(r => r.id === reqId);
      if (!reqItem) return prevCols;

      return prevCols.map(col => {
        if (col.id === fromColId) {
          return {
            ...col,
            requests: col.requests.filter(r => r.id !== reqId)
          };
        }
        if (col.id === toColId) {
          return {
            ...col,
            requests: [...col.requests, reqItem]
          };
        }
        return col;
      });
    });
  };

  const deleteRequestFromSidebar = (reqId: string, colId: string) => {
    if (!confirm("Are you sure you want to delete this request?")) return;
    setCollections(prevCols => {
      return prevCols.map(col => {
        if (col.id === colId) {
          return {
            ...col,
            requests: col.requests.filter(r => r.id !== reqId)
          };
        }
        return col;
      });
    });
  };

  const fetchTroubleshootingAdvice = async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !tab.response || tab.aiTroubleshootResult || tab.isTroubleshooting) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, isTroubleshooting: true } : t
      )
    );

    try {
      const requestDetails = {
        method: tab.method,
        url: tab.url,
        headers: tab.headers.filter((h) => h.enabled && h.key),
        params: tab.params.filter((p) => p.enabled && p.key),
        body: tab.body
      };

      const responseDetails = "error" in tab.response 
        ? { error: tab.response.error } 
        : {
            status: tab.response.status,
            statusText: tab.response.statusText,
            headers: tab.response.headers,
            body: tab.response.body
          };

      const prompt = `Troubleshoot this failed HTTP request:
Request Details:
${JSON.stringify(requestDetails, null, 2)}

Response Details:
${JSON.stringify(responseDetails, null, 2)}`;

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "troubleshoot",
          content: prompt
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json() as { result: string };
      
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, aiTroubleshootResult: data.result, isTroubleshooting: false }
            : t
        )
      );
    } catch (e: any) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? { ...t, aiTroubleshootResult: `Troubleshooting request failed: ${e.message}`, isTroubleshooting: false }
            : t
        )
      );
    }
  };

  // Filter sidebar requests
  const filteredCollections = useMemo(() => {
    if (!sidebarSearch.trim()) return collections;
    
    return collections.map((col) => {
      const filteredReqs = col.requests.filter((r) =>
        r.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        r.url.toLowerCase().includes(sidebarSearch.toLowerCase())
      );
      return {
        ...col,
        requests: filteredReqs
      };
    }).filter((col) => col.requests.length > 0);
  }, [collections, sidebarSearch]);

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#0F1015", // Premium deep dark color
      color: "#e1e4e8",
      overflow: "hidden"
    }}>
      {/* 1. App Top Header */}
      <div style={{
        height: 48,
        background: "#0a0b0d",
        borderBottom: "1px solid #1a1c24",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        userSelect: "none"
      }}>
        {/* Left Side: Window dots + arrows + workspace */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* OS Window control dots */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56", display: "inline-block" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e", display: "inline-block" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#27c93f", display: "inline-block" }} />
          </div>

          {/* Navigation Arrows */}
          <div style={{ display: "flex", gap: 10, marginLeft: 12, color: "#6e7681" }}>
            <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>←</button>
            <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>→</button>
          </div>

          {/* Workspace Switcher */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#161b22",
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid #30363d",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            marginLeft: 8
          }}>
            <span>My Workspace</span>
            <span style={{ fontSize: 9, color: "#8b949e" }}>▼</span>
          </div>

          {/* Top Actions */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={createNewTab} style={{
              background: "#1f242d",
              border: "1px solid #30363d",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              color: "#c9d1d9",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
              <span style={{ fontSize: 14, fontWeight: "bold" }}>+</span> New
            </button>
            <button style={{
              background: "none",
              border: "1px solid #30363d",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              color: "#c9d1d9"
            }}>
              Import
            </button>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div style={{ flex: 1, maxWidth: 460, margin: "0 24px", position: "relative" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14 }} fill="none" stroke="#6e7681" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search (⌘ + K)"
            style={{
              width: "100%",
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 20,
              padding: "5px 12px 5px 32px",
              fontSize: "12px",
              color: "#c9d1d9",
              outline: "none"
            }}
          />
        </div>

        {/* Right Side: Invite / Avatar / Settings */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            background: "#1f6feb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0Zm-2-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
              <path d="M8.256 14a4.474 4.474 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256Z"/>
            </svg>
            Invite
          </button>
          
          <button style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 16 }} title="Settings">⚙️</button>
          <button style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 16 }} title="Notifications">🔔</button>
          
          <div style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "#8275F5",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: "bold",
            cursor: "pointer"
          }}>
            M
          </div>
          
          <button style={{
            background: "none",
            border: "1px solid #f59e0b",
            color: "#f59e0b",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer"
          }}>
            Upgrade
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Split Layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Left Side: Sidebar Panel */}
        <div style={{
          width: 250,
          background: "#0e1014",
          borderRight: "1px solid #1a1c24",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Main Sidebar Rail Items */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderBottom: "1px solid #1a1c24"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#8b949e" }}>My APIs</span>
            <button
              onClick={handleCreateFolder}
              style={{
                background: "#161b22",
                border: "1px solid #30363d",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: "10px",
                color: "#8b949e",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              + Folder
            </button>
          </div>

          {/* Sidebar Search + Plus */}
          <div style={{ display: "flex", gap: 6, padding: "8px 10px" }}>
            <input
              type="text"
              placeholder="Filter endpoints…"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              style={{
                flex: 1,
                background: "#161b22",
                border: "1px solid #21262d",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: "11.5px",
                color: "#c9d1d9",
                outline: "none"
              }}
            />
            <button onClick={createNewTab} style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: 4,
              padding: "0 8px",
              color: "#8b949e",
              fontWeight: "bold",
              cursor: "pointer"
            }} title="New request builder">+</button>
          </div>

          {/* Folder Tree */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
            {filteredCollections.map((col) => {
              const isCollapsed = collapsedFolders[col.id];
              return (
                <div key={col.id} style={{ marginBottom: 6 }}>
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolder(col.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#c9d1d9"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#161b22"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: 10, color: "#8b949e", transition: "transform 0.15s", transform: isCollapsed ? "rotate(-90deg)" : "none", display: "inline-block" }}>▼</span>
                    <span style={{ fontSize: 12 }}>📁</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.name}</span>
                  </div>

                  {/* Folder Items (Requests) */}
                  {!isCollapsed && (
                    <div style={{ paddingLeft: 16, marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                      {col.requests.map((req) => {
                        const isActive = activeTabId === req.id;
                        const isMenuOpen = activeMenuReq === req.id;
                        return (
                          <div
                            key={req.id}
                            onClick={() => openRequest(req)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "5px 8px",
                              borderRadius: 4,
                              cursor: "pointer",
                              background: isActive ? "#1c212c" : "transparent",
                              position: "relative"
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#161b22"; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{
                              fontSize: "9px",
                              fontWeight: 800,
                              color: METHOD_COLORS[req.method],
                              width: 32,
                              textAlign: "left"
                            }}>
                              {req.method === "DELETE" ? "DEL" : req.method}
                            </span>
                            <span style={{
                              fontSize: "11.5px",
                              color: isActive ? "#58a6ff" : "#8b949e",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1
                            }}>
                              {req.name}
                            </span>

                            {/* Dropdown Options Trigger */}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuReq(isMenuOpen ? null : req.id);
                              }}
                              style={{
                                color: "#8b949e",
                                fontSize: "12px",
                                padding: "0 4px",
                                borderRadius: 3,
                                cursor: "pointer",
                                userSelect: "none"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = "#c9d1d9"}
                              onMouseLeave={(e) => e.currentTarget.style.color = "#8b949e"}
                              title="Request Actions"
                            >
                              •••
                            </span>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div style={{
                                position: "absolute",
                                left: 60,
                                top: 22,
                                background: "#161b22",
                                border: "1px solid #30363d",
                                borderRadius: 6,
                                padding: "4px 0",
                                zIndex: 999,
                                width: 160,
                                boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
                              }}>
                                <div style={{ padding: "4px 10px", fontSize: "10px", color: "#8b949e", borderBottom: "1px solid #21262d", fontWeight: "bold" }}>
                                  Move to Folder:
                                </div>
                                {collections.map(c => (
                                  <div 
                                    key={c.id} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveRequestToFolder(req.id, col.id, c.id);
                                      setActiveMenuReq(null);
                                    }}
                                    style={{
                                      padding: "6px 10px",
                                      fontSize: "11.5px",
                                      color: c.id === col.id ? "#58a6ff" : "#c9d1d9",
                                      cursor: "pointer",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#1f242d"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    {c.name} {c.id === col.id && "✓"}
                                  </div>
                                ))}
                                <div style={{ borderTop: "1px solid #21262d", margin: "4px 0" }} />
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRequestFromSidebar(req.id, col.id);
                                    setActiveMenuReq(null);
                                  }}
                                  style={{
                                    padding: "6px 10px",
                                    fontSize: "11.5px",
                                    color: "#ff7b72",
                                    cursor: "pointer"
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = "#1f242d"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  Delete
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Request Builder + Response Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0D0E12", overflow: "hidden" }}>
          
          {/* Tabs Bar */}
          <div style={{
            height: 38,
            background: "#08090b",
            borderBottom: "1px solid #1a1c24",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingRight: 12
          }}>
            <div style={{ display: "flex", overflowX: "auto", height: "100%", scrollbarWidth: "none" }}>
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 14px",
                      height: "100%",
                      borderRight: "1px solid #1a1c24",
                      background: isActive ? "#0D0E12" : "#08090b",
                      borderTop: isActive ? "2px solid #ff6c37" : "2px solid transparent", // Postman orange indicator
                      cursor: "pointer",
                      minWidth: 120,
                      maxWidth: 180,
                      userSelect: "none"
                    }}
                  >
                    <span style={{ fontSize: "9px", fontWeight: 800, color: METHOD_COLORS[tab.method] }}>
                      {tab.method === "DELETE" ? "DEL" : tab.method}
                    </span>
                    <span style={{
                      fontSize: "11.5px",
                      color: isActive ? "#e1e4e8" : "#8b949e",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1
                    }}>
                      {tab.name}
                    </span>
                    
                    {tab.isDirty && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff6c37" }} />
                    )}

                    <button
                      onClick={(e) => closeTab(tab.id, e)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#6e7681",
                        fontSize: 10,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 2,
                        borderRadius: "50%"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#21262d"; e.currentTarget.style.color = "#f0f6fc"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6e7681"; }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <button
                onClick={createNewTab}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8b949e",
                  fontSize: 18,
                  padding: "0 12px",
                  cursor: "pointer"
                }}
                title="Open new tab"
              >
                +
              </button>
            </div>

            {/* Right tab options: Environment Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={environment}
                onChange={(e: any) => setEnvironment(e.target.value)}
                style={{
                  background: "#161b22",
                  border: "1px solid #30363d",
                  color: "#c9d1d9",
                  fontSize: "11.5px",
                  padding: "3px 8px",
                  borderRadius: 4,
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="No Environment">No Environment</option>
                <option value="Development">Development</option>
                <option value="Staging">Staging</option>
                <option value="Production">Production</option>
              </select>
            </div>
          </div>

          {activeTab ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              
              {/* Active Request Info Bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid #1a1c24"
              }}>
                {/* Path breadcrumb */}
                {(() => {
                  const parentCol = collections.find(c => c.requests.some(r => r.id === activeTab.id));
                  return (
                    <div style={{ fontSize: "11.5px", color: "#8b949e", display: "flex", alignItems: "center", gap: 6 }}>
                      {parentCol ? (
                        <>
                          <span style={{ color: "#58a6ff" }}>📁 {parentCol.name}</span>
                          <span style={{ color: "#30363d" }}>/</span>
                        </>
                      ) : null}
                      <span style={{ color: "#c9d1d9", fontWeight: 500 }}>{activeTab.name}</span>
                    </div>
                  );
                })()}

                {/* Header Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleOpenSaveModal}
                    disabled={saveRequestStatus === "saving"}
                    style={{
                      background: saveRequestStatus === "saved" ? "#238636" : "#161b22",
                      border: saveRequestStatus === "saved" ? "1px solid #238636" : "1px solid #30363d",
                      color: saveRequestStatus === "saved" ? "#ffffff" : "#c9d1d9",
                      padding: "3px 10px",
                      borderRadius: 4,
                      fontSize: "11.5px",
                      cursor: "pointer",
                      fontWeight: saveRequestStatus === "saved" ? "bold" : "normal"
                    }}
                  >
                    {saveRequestStatus === "saved" ? "Saved! ✓" : saveRequestStatus === "saving" ? "Saving..." : "Save"}
                  </button>
                  <button style={{
                    background: "none",
                    border: "none",
                    color: "#8b949e",
                    cursor: "pointer",
                    fontSize: 14
                  }} title="Code generation">💻</button>
                </div>
              </div>

              {/* URL Builder Bar */}
              <div style={{
                padding: "12px 16px",
                display: "flex",
                gap: 10,
                alignItems: "center",
                borderBottom: "1px solid #1a1c24"
              }}>
                {/* Method Select */}
                <select
                  id="postman-method-select"
                  value={activeTab.method}
                  onChange={(e) => updateTabField("method", e.target.value as HttpMethod)}
                  style={{
                    background: "#161b22",
                    color: METHOD_COLORS[activeTab.method],
                    fontWeight: 800,
                    fontSize: "12.5px",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #30363d",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                    <option key={m} value={m} style={{ color: METHOD_COLORS[m as HttpMethod], fontWeight: 800, background: "#0D0E12" }}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* URL Input */}
                <input
                  id="postman-url-input"
                  type="text"
                  value={activeTab.url}
                  onChange={(e) => updateTabUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder="Enter request URL (e.g. https://api.example.com/v1/users)"
                  style={{
                    flex: 1,
                    background: "#161b22",
                    color: "#c9d1d9",
                    fontSize: "12.5px",
                    fontFamily: "var(--font-mono)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid #30363d",
                    outline: "none"
                  }}
                />

                {/* Send Button */}
                <button
                  id="postman-send-btn"
                  onClick={handleSend}
                  disabled={isSending}
                  style={{
                    padding: "8px 24px",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    borderRadius: 6,
                    border: "none",
                    background: "#1f6feb",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(31, 111, 235, 0.2)"
                  }}
                >
                  {isSending ? "Sending…" : "Send"}
                </button>
              </div>

              {/* Request Configuration Section */}
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", borderBottom: "1px solid #1a1c24" }}>
                {/* Request Tabs */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  background: "#0a0b0d",
                  borderBottom: "1px solid #1a1c24"
                }}>
                  <div style={{ display: "flex" }}>
                    {[
                      { id: "params", label: `Params${activeTab.params.filter(p => p.key).length > 0 ? " •" : ""}` },
                      { id: "authorization", label: "Authorization" },
                      { id: "headers", label: `Headers (${activeTab.headers.filter(h => h.key).length})` },
                      { id: "body", label: "Body" },
                      { id: "pre-script", label: "Pre-request Script" },
                      { id: "tests", label: "Tests" },
                      { id: "settings", label: "Settings" }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => updateTabField("activeReqTab", t.id as any)}
                        style={{
                          background: "none",
                          border: "none",
                          color: activeTab.activeReqTab === t.id ? "#e1e4e8" : "#8b949e",
                          borderBottom: activeTab.activeReqTab === t.id ? "2px solid #ff6c37" : "2px solid transparent",
                          padding: "10px 14px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer"
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <span style={{ fontSize: "11px", color: "#58a6ff", cursor: "pointer", fontWeight: 500 }}>Cookies</span>
                </div>

                {/* Request Tab Details Panel */}
                <div style={{ padding: "14px 16px", background: "#0D0E12", maxHeight: 260, overflowY: "auto" }}>
                  
                  {/* PARAMS TAB */}
                  {activeTab.activeReqTab === "params" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#8b949e" }}>Query Params</span>
                        <span style={{ fontSize: "11px", color: "#58a6ff", cursor: "pointer" }}>Bulk Edit</span>
                      </div>
                      <div style={{ border: "1px solid #30363d", borderRadius: 6, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                          <thead>
                            <tr style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                              <th style={{ width: 36, padding: "6px 8px" }}></th>
                              <th style={{ borderRight: "1px solid #30363d", padding: "6px 12px", textAlign: "left", color: "#8b949e" }}>KEY</th>
                              <th style={{ borderRight: "1px solid #30363d", padding: "6px 12px", textAlign: "left", color: "#8b949e" }}>VALUE</th>
                              <th style={{ padding: "6px 12px", textAlign: "left", color: "#8b949e" }}>DESCRIPTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeTab.params.map((param, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #21262d" }}>
                                <td style={{ textAlign: "center", padding: "4px 8px", borderRight: "1px solid #21262d" }}>
                                  <input
                                    type="checkbox"
                                    checked={param.enabled}
                                    onChange={(e) => {
                                      const copy = [...activeTab.params];
                                      copy[idx].enabled = e.target.checked;
                                      updateTabParams(copy);
                                    }}
                                  />
                                </td>
                                <td style={{ borderRight: "1px solid #21262d", padding: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Key"
                                    value={param.key}
                                    onChange={(e) => {
                                      const copy = [...activeTab.params];
                                      copy[idx].key = e.target.value;
                                      
                                      // Add next empty row if user types in the last row
                                      if (idx === copy.length - 1 && e.target.value) {
                                        copy.push({ enabled: true, key: "", value: "", description: "" });
                                      }
                                      updateTabParams(copy);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "none",
                                      color: "#c9d1d9",
                                      padding: "6px 12px",
                                      outline: "none",
                                      fontFamily: "var(--font-mono)"
                                    }}
                                  />
                                </td>
                                <td style={{ borderRight: "1px solid #21262d", padding: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Value"
                                    value={param.value}
                                    onChange={(e) => {
                                      const copy = [...activeTab.params];
                                      copy[idx].value = e.target.value;
                                      if (idx === copy.length - 1 && e.target.value) {
                                        copy.push({ enabled: true, key: "", value: "", description: "" });
                                      }
                                      updateTabParams(copy);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "none",
                                      color: "#c9d1d9",
                                      padding: "6px 12px",
                                      outline: "none",
                                      fontFamily: "var(--font-mono)"
                                    }}
                                  />
                                </td>
                                <td style={{ padding: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Description"
                                    value={param.description}
                                    onChange={(e) => {
                                      const copy = [...activeTab.params];
                                      copy[idx].description = e.target.value;
                                      updateTabParams(copy);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "none",
                                      color: "#c9d1d9",
                                      padding: "6px 12px",
                                      outline: "none"
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* AUTHORIZATION TAB */}
                  {activeTab.activeReqTab === "authorization" && (() => {
                    const authHeaderIdx = activeTab.headers.findIndex(h => h.key.toLowerCase() === "authorization");
                    const authHeaderValue = authHeaderIdx !== -1 ? activeTab.headers[authHeaderIdx].value : "";
                    // Detect type from value
                    const isBearerToken = authHeaderValue.startsWith("Bearer ") || (!authHeaderValue.startsWith("Basic ") && authHeaderValue.length > 0);
                    const isBasicAuth = authHeaderValue.startsWith("Basic ");

                    const applyAuth = (value: string) => {
                      const copy = [...activeTab.headers];
                      const existing = copy.findIndex(h => h.key.toLowerCase() === "authorization");
                      if (value.trim()) {
                        if (existing !== -1) {
                          copy[existing] = { ...copy[existing], value, enabled: true };
                        } else {
                          // Insert before the empty row
                          const emptyIdx = copy.findIndex(h => !h.key);
                          const newRow = { enabled: true, key: "Authorization", value, description: "Auth header" };
                          if (emptyIdx !== -1) {
                            copy.splice(emptyIdx, 0, newRow);
                          } else {
                            copy.push(newRow);
                          }
                        }
                      } else if (existing !== -1) {
                        copy.splice(existing, 1);
                      }
                      updateTabField("headers", copy);
                    };

                    return (
                      <div style={{ display: "flex", gap: 20, fontSize: "12.5px" }}>
                        {/* Auth Type Selector */}
                        <div style={{ width: 200 }}>
                          <label style={{ display: "block", color: "#8b949e", fontSize: "11px", marginBottom: 6, fontWeight: 600 }}>AUTH TYPE</label>
                          <select
                            style={{
                              width: "100%", background: "#161b22", border: "1px solid #30363d",
                              color: "#c9d1d9", padding: "7px 10px", borderRadius: 6, outline: "none", cursor: "pointer"
                            }}
                            value={isBasicAuth ? "basic" : authHeaderValue ? "bearer" : "none"}
                            onChange={(e) => {
                              if (e.target.value === "none") applyAuth("");
                              else if (e.target.value === "bearer") applyAuth("Bearer ");
                              else if (e.target.value === "basic") applyAuth("Basic ");
                              else if (e.target.value === "apikey") applyAuth("");
                            }}
                          >
                            <option value="none">No Auth</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="basic">Basic Auth</option>
                            <option value="apikey">API Key</option>
                          </select>
                        </div>

                        {/* Auth Fields */}
                        <div style={{ flex: 1 }}>
                          {(isBasicAuth ? false : authHeaderValue !== "") && (
                            <>
                              <label style={{ display: "block", color: "#8b949e", fontSize: "11px", marginBottom: 6, fontWeight: 600 }}>TOKEN</label>
                              <input
                                type="text"
                                placeholder="Enter Bearer token..."
                                value={authHeaderValue.replace(/^Bearer /, "")}
                                onChange={(e) => applyAuth(`Bearer ${e.target.value}`)}
                                style={{
                                  width: "100%", background: "#161b22", border: "1px solid #30363d",
                                  color: "#c9d1d9", padding: "7px 12px", borderRadius: 6, outline: "none",
                                  fontFamily: "var(--font-mono)", fontSize: "12px"
                                }}
                              />
                              <p style={{ marginTop: 6, fontSize: "11px", color: "#8b949e" }}>
                                This will set the <code style={{ color: "#ffab70", background: "#21262d", padding: "1px 4px", borderRadius: 3 }}>Authorization: Bearer &lt;token&gt;</code> header.
                              </p>
                            </>
                          )}
                          {isBasicAuth && (
                            <>
                              <label style={{ display: "block", color: "#8b949e", fontSize: "11px", marginBottom: 6, fontWeight: 600 }}>USERNAME</label>
                              <input
                                type="text"
                                placeholder="Username"
                                onChange={(e) => {
                                  const parts = atob(authHeaderValue.replace("Basic ", "") || "").split(":");
                                  const encoded = btoa(`${e.target.value}:${parts[1] || ""}`);
                                  applyAuth(`Basic ${encoded}`);
                                }}
                                style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9", padding: "7px 12px", borderRadius: 6, outline: "none", marginBottom: 8 }}
                              />
                              <label style={{ display: "block", color: "#8b949e", fontSize: "11px", marginBottom: 6, fontWeight: 600 }}>PASSWORD</label>
                              <input
                                type="password"
                                placeholder="Password"
                                onChange={(e) => {
                                  const parts = atob(authHeaderValue.replace("Basic ", "") || "").split(":");
                                  const encoded = btoa(`${parts[0] || ""}:${e.target.value}`);
                                  applyAuth(`Basic ${encoded}`);
                                }}
                                style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9", padding: "7px 12px", borderRadius: 6, outline: "none" }}
                              />
                            </>
                          )}
                          {!authHeaderValue && (
                            <p style={{ color: "#8b949e", fontSize: "12px", marginTop: 8 }}>Select an auth type to configure credentials. The header will be automatically injected into the request.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* HEADERS TAB */}
                  {activeTab.activeReqTab === "headers" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#8b949e" }}>Headers List</span>
                      </div>
                      <div style={{ border: "1px solid #30363d", borderRadius: 6, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                          <thead>
                            <tr style={{ background: "#161b22", borderBottom: "1px solid #30363d" }}>
                              <th style={{ width: 36, padding: "6px 8px" }}></th>
                              <th style={{ borderRight: "1px solid #30363d", padding: "6px 12px", textAlign: "left", color: "#8b949e" }}>KEY</th>
                              <th style={{ borderRight: "1px solid #30363d", padding: "6px 12px", textAlign: "left", color: "#8b949e" }}>VALUE</th>
                              <th style={{ padding: "6px 12px", textAlign: "left", color: "#8b949e" }}>DESCRIPTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeTab.headers.map((header, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #21262d" }}>
                                <td style={{ textAlign: "center", padding: "4px 8px", borderRight: "1px solid #21262d" }}>
                                  <input
                                    type="checkbox"
                                    checked={header.enabled}
                                    onChange={(e) => {
                                      const copy = [...activeTab.headers];
                                      copy[idx].enabled = e.target.checked;
                                      updateTabField("headers", copy);
                                    }}
                                  />
                                </td>
                                <td style={{ borderRight: "1px solid #21262d", padding: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Key"
                                    value={header.key}
                                    onChange={(e) => {
                                      const copy = [...activeTab.headers];
                                      copy[idx].key = e.target.value;
                                      if (idx === copy.length - 1 && e.target.value) {
                                        copy.push({ enabled: true, key: "", value: "", description: "" });
                                      }
                                      updateTabField("headers", copy);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "none",
                                      color: "#c9d1d9",
                                      padding: "6px 12px",
                                      outline: "none",
                                      fontFamily: "var(--font-mono)"
                                    }}
                                  />
                                </td>
                                <td style={{ borderRight: "1px solid #21262d", padding: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Value"
                                    value={header.value}
                                    onChange={(e) => {
                                      const copy = [...activeTab.headers];
                                      copy[idx].value = e.target.value;
                                      if (idx === copy.length - 1 && e.target.value) {
                                        copy.push({ enabled: true, key: "", value: "", description: "" });
                                      }
                                      updateTabField("headers", copy);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "none",
                                      color: "#c9d1d9",
                                      padding: "6px 12px",
                                      outline: "none",
                                      fontFamily: "var(--font-mono)"
                                    }}
                                  />
                                </td>
                                <td style={{ padding: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Description"
                                    value={header.description}
                                    onChange={(e) => {
                                      const copy = [...activeTab.headers];
                                      copy[idx].description = e.target.value;
                                      updateTabField("headers", copy);
                                    }}
                                    style={{
                                      width: "100%",
                                      background: "transparent",
                                      border: "none",
                                      color: "#c9d1d9",
                                      padding: "6px 12px",
                                      outline: "none"
                                    }}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* BODY TAB */}
                  {activeTab.activeReqTab === "body" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: "11.5px" }}>
                        <span style={{ color: "#8b949e" }}>Body Content Type:</span>
                        <span style={{ color: "#ff6c37", fontWeight: "bold", background: "#211a17", padding: "2px 8px", borderRadius: 4 }}>json (application/json)</span>
                        
                        <button
                          id="postman-sync-blob-btn"
                          onClick={() => updateTabField("body", activeBlobContent)}
                          style={{
                            marginLeft: "auto",
                            background: "#161b22",
                            border: "1px solid #30363d",
                            color: "#58a6ff",
                            padding: "3px 10px",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: 500
                          }}
                        >
                          Sync Active Blob JSON
                        </button>
                      </div>
                      <textarea
                        id="postman-req-body"
                        value={activeTab.body}
                        onChange={(e) => updateTabField("body", e.target.value)}
                        placeholder={`{\n  "key": "value"\n}`}
                        style={{
                          width: "100%",
                          height: 120,
                          background: "#0a0b0d",
                          color: "#c9d1d9",
                          border: "1px solid #30363d",
                          borderRadius: 6,
                          outline: "none",
                          padding: 12,
                          fontFamily: "var(--font-mono)",
                          fontSize: "12.5px",
                          resize: "vertical"
                        }}
                      />
                    </div>
                  )}

                  {/* UNIMPLEMENTED PLACEHOLDERS FOR HIGH FIDELITY */}
                  {["pre-script", "tests", "settings"].includes(activeTab.activeReqTab) && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", color: "#8b949e" }}>
                      <span style={{ fontSize: 24, marginBottom: 8 }}>⚡</span>
                      <span style={{ fontSize: "12px" }}>Custom actions can be scripted for pre-request and test logic validation.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Response Panel Section */}
              <div style={{ flex: 1, borderTop: "2px solid #1a1c24", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                
                {/* Response Tabs & Meta */}
                <div style={{
                  height: 38,
                  background: "#0a0b0d",
                  borderBottom: "1px solid #1a1c24",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px"
                }}>
                  {/* Left Response Tabs */}
                  <div style={{ display: "flex" }}>
                    {(() => {
                      // Detect HTTP-level error
                      const httpError = activeTab.response && (
                        "error" in activeTab.response ||
                        ("status" in activeTab.response && (activeTab.response.status < 200 || activeTab.response.status >= 300))
                      );

                      // Detect app-level error: HTTP 200 but body has error indicators
                      let appLevelError = false;
                      if (!httpError && activeTab.response && "body" in activeTab.response && activeTab.response.body) {
                        try {
                          const parsed = JSON.parse(activeTab.response.body);
                          // Common app-level error patterns
                          const appStatus = parsed?.status ?? parsed?.code ?? parsed?.statusCode;
                          const appMsg = (parsed?.message ?? parsed?.error ?? "").toString().toLowerCase();
                          const isErrorStatus = typeof appStatus === "number" && (appStatus >= 2000 || (appStatus !== 1000 && appStatus >= 400));
                          const isErrorMsg = appMsg.includes("unauthorized") || appMsg.includes("forbidden") || appMsg.includes("invalid token") || appMsg.includes("unauthenticated") || appMsg.includes("access denied");
                          appLevelError = isErrorStatus || isErrorMsg;
                        } catch {}
                      }

                      const shouldShowTroubleshoot = httpError || appLevelError;

                      const resTabs = [
                        { id: "body", label: "Body" },
                        { id: "cookies", label: "Cookies (0)" },
                        { id: "headers", label: "Headers" },
                        { id: "tests", label: "Test Results" }
                      ];

                      if (shouldShowTroubleshoot) {
                        resTabs.push({ id: "ai_troubleshoot", label: "💡 AI Troubleshoot" });
                      }

                      return resTabs.map((t) => (
                        <button
                          key={t.id}
                          id={`postman-res-tab-${t.id}`}
                          onClick={() => {
                            updateTabField("activeResTab", t.id as any);
                            if (t.id === "ai_troubleshoot") {
                              fetchTroubleshootingAdvice(activeTab.id);
                            }
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: activeTab.activeResTab === t.id ? "#e1e4e8" : t.id === "ai_troubleshoot" ? "#f0883e" : "#8b949e",
                            borderBottom: activeTab.activeResTab === t.id ? "2px solid #ff6c37" : "2px solid transparent",
                            padding: "10px 14px",
                            fontSize: "12px",
                            fontWeight: t.id === "ai_troubleshoot" ? 600 : 500,
                            cursor: "pointer"
                          }}
                        >
                          {t.label}
                        </button>
                      ));
                    })()}
                  </div>

                  {/* Right Response Meta */}
                  {activeTab.response && (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "12px" }}>
                      {"status" in activeTab.response && (() => {
                        // Check for app-level error to show alongside HTTP status
                        let appStatus: number | null = null;
                        let appMessage: string | null = null;
                        try {
                          const parsed = JSON.parse(activeTab.response.body);
                          if (parsed?.status !== undefined && typeof parsed.status === "number") appStatus = parsed.status;
                          if (parsed?.message) appMessage = parsed.message;
                        } catch {}

                        const httpOk = activeTab.response.status >= 200 && activeTab.response.status < 300;
                        const appOk = appStatus === null || appStatus === 200 || appStatus === 1000 || (appStatus >= 200 && appStatus < 300);

                        return (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {/* HTTP Status */}
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              <span style={{ color: "#8b949e" }}>HTTP:</span>
                              <span style={{
                                color: httpOk ? "#3fb950"
                                  : activeTab.response.status >= 300 && activeTab.response.status < 400 ? "#f0883e"
                                  : "#f85149",
                                fontWeight: "bold"
                              }}>
                                {activeTab.response.status} {activeTab.response.statusText}
                              </span>
                            </div>

                            {/* App-level Status (if different from HTTP) */}
                            {appStatus !== null && (
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <span style={{ color: "#8b949e" }}>App:</span>
                                <span style={{
                                  color: appOk ? "#3fb950" : "#f85149",
                                  fontWeight: "bold",
                                  background: appOk ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  fontSize: "11px"
                                }}>
                                  {appStatus}{appMessage ? ` · ${appMessage}` : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {"time" in activeTab.response && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: "#8b949e" }}>Time:</span>
                          <span style={{ color: "#56b6c2", fontWeight: "bold" }}>
                            {activeTab.response.time} ms
                          </span>
                        </div>
                      )}

                      {"size" in activeTab.response && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ color: "#8b949e" }}>Size:</span>
                          <span style={{ color: "#56b6c2", fontWeight: "bold" }}>
                            {activeTab.response.size}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Response Code/Data Box */}
                <div style={{ flex: 1, overflowY: "auto", background: "#0d0e12" }}>
                  
                  {isSending ? (
                    <div style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 16,
                      color: "#8b949e"
                    }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        border: "3px solid #21262d",
                        borderTop: "3px solid #1f6feb",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                      }} />
                      <span style={{ fontSize: "13px" }}>Sending request…</span>
                      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
                    </div>
                  ) : activeTab.response ? (
                    "error" in activeTab.response ? (
                      <div style={{ padding: 16, color: "#ff7b72", background: "#210f11", margin: 16, borderRadius: 6, border: "1px solid #ff7b72" }}>
                        ⚠️ Request Failed: {activeTab.response.error}
                      </div>
                    ) : (
                      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        
                        {/* Response body control bar */}
                        {activeTab.activeResTab === "body" && (
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 16px",
                            borderBottom: "1px solid #1a1c24",
                            background: "#08090b"
                          }}>
                            <div style={{ display: "flex", gap: 4, background: "#161b22", borderRadius: 4, padding: 2 }}>
                              <button
                                onClick={() => updateTabField("prettyFormat", true)}
                                style={{
                                  background: activeTab.prettyFormat ? "#21262d" : "transparent",
                                  border: "none", color: "#c9d1d9", fontSize: "11px",
                                  padding: "3px 8px", borderRadius: 3, cursor: "pointer", fontWeight: activeTab.prettyFormat ? 600 : "normal"
                                }}
                              >
                                Pretty
                              </button>
                              <button
                                onClick={() => updateTabField("prettyFormat", false)}
                                style={{
                                  background: !activeTab.prettyFormat ? "#21262d" : "transparent",
                                  border: "none", color: "#c9d1d9", fontSize: "11px",
                                  padding: "3px 8px", borderRadius: 3, cursor: "pointer", fontWeight: !activeTab.prettyFormat ? 600 : "normal"
                                }}
                              >
                                Raw
                              </button>
                            </div>

                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span style={{ fontSize: "11px", color: "#8b949e" }}>JSON</span>
                              {onCreateBlobWithContent && (
                                <button
                                  id="postman-save-as-blob-btn"
                                  onClick={handleSaveResponse}
                                  style={{
                                    background: "#238636",
                                    color: "#fff",
                                    border: "none",
                                    padding: "3px 10px",
                                    borderRadius: 4,
                                    fontSize: "11px",
                                    cursor: "pointer",
                                    fontWeight: 600
                                  }}
                                >
                                  Save Response as JSON Blob
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* BODY DATA VIEW */}
                        {activeTab.activeResTab === "body" && (
                          <div style={{ padding: 12, flex: 1 }} id="postman-res-body-display">
                            {activeTab.prettyFormat
                              ? highlightJSON(activeTab.response.body)
                              : (
                                <pre style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "12.5px",
                                  color: "#c9d1d9",
                                  margin: 0,
                                  whiteSpace: "pre-wrap"
                                }}>{activeTab.response.body}</pre>
                              )}
                          </div>
                        )}

                        {/* HEADERS RESPONSE VIEW */}
                        {activeTab.activeResTab === "headers" && (
                          <div style={{ padding: 16 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                              <thead>
                                <tr style={{ borderBottom: "2px solid #30363d", color: "#8b949e" }}>
                                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Header</th>
                                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(activeTab.response.headers).map(([key, val]) => (
                                  <tr key={key} style={{ borderBottom: "1px solid #21262d" }}>
                                    <td style={{ padding: "8px 12px", color: "#58a6ff", fontWeight: 500 }}>{key}</td>
                                    <td style={{ padding: "8px 12px", color: "#c9d1d9" }}>{val}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* AI TROUBLESHOOT RESPONSE VIEW */}
                        {activeTab.activeResTab === "ai_troubleshoot" && (
                          <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", background: "#0d0e12" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                              <span style={{ fontSize: "18px", color: "#ff6c37" }}>✦</span>
                              <span style={{ fontSize: "14px", fontWeight: 600, color: "#f0f6fc" }}>
                                AI Troubleshooter Diagnosis & Fix
                              </span>
                            </div>

                            {activeTab.isTroubleshooting ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ fontSize: "12.5px", color: "#8b949e" }} className="animate-pulse">
                                  Analyzing request params, headers, body, and non-200 response to prepare a resolution...
                                </div>
                                <div style={{ background: "#161b22", height: 16, borderRadius: 4, width: "100%" }} className="animate-pulse" />
                                <div style={{ background: "#161b22", height: 16, borderRadius: 4, width: "85%" }} className="animate-pulse" />
                                <div style={{ background: "#161b22", height: 16, borderRadius: 4, width: "90%" }} className="animate-pulse" />
                              </div>
                            ) : activeTab.aiTroubleshootResult ? (
                              <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#c9d1d9" }}>
                                {renderMarkdown(activeTab.aiTroubleshootResult)}
                              </div>
                            ) : (
                              <div style={{ color: "#8b949e", fontSize: "12.5px" }}>
                                Click the troubleshoot tab or wait for response analysis to begin.
                              </div>
                            )}
                          </div>
                        )}

                        {/* UNIMPLEMENTED PLACEHOLDERS FOR HIGH FIDELITY */}
                        {["cookies", "tests"].includes(activeTab.activeResTab) && (
                          <div style={{ padding: 24, textAlign: "center", color: "#8b949e", fontSize: "12.5px" }}>
                            No cookies returned / No assertions executed.
                          </div>
                        )}

                      </div>
                    )
                  ) : (
                    <div style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#8b949e",
                      padding: 32
                    }}>
                      <span style={{ fontSize: 32, marginBottom: 12 }}>🚀</span>
                      <span style={{ fontSize: "13px" }}>
                        Click <strong>Send</strong> to execute API request and inspect JSON response.
                      </span>
                    </div>
                  )}

                </div>
              </div>

            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyItems: "center", color: "#8b949e", justifyContent: "center" }}>
              No request active. Click "+" in sidebar or tabs to create one.
            </div>
          )}

        </div>

        {/* Right Side: Documentation panel */}
        {docOpen && activeTab && (
          <div style={{
            width: 280,
            background: "#0e1014",
            borderLeft: "1px solid #1a1c24",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Doc Header */}
            <div style={{
              height: 38,
              borderBottom: "1px solid #1a1c24",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
              background: "#08090b"
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#e1e4e8" }}>Documentation</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ cursor: "pointer", color: "#8b949e", fontSize: 13 }}>•••</span>
                <span onClick={() => setDocOpen(false)} style={{ cursor: "pointer", color: "#8b949e", fontSize: 13 }}>✕</span>
              </div>
            </div>

            {/* Doc Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", fontSize: "12.5px" }}>
              <span style={{ fontSize: "11px", color: "#58a6ff", fontWeight: 600, textTransform: "uppercase" }}>User Service API</span>
              <h3 style={{ fontSize: "16px", color: "#f0f6fc", margin: "4px 0 10px 0" }}>{activeTab.name}</h3>
              
              <p style={{ color: "#8b949e", lineHeight: 1.5, marginBottom: 16 }}>
                {activeTab.description}
              </p>

              {/* Params Doc */}
              {activeTab.params.filter(p => p.key).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ color: "#c9d1d9", fontWeight: 600, marginBottom: 8, fontSize: "12px" }}>Query Parameters</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeTab.params.filter(p => p.key).map((p) => (
                      <div key={p.key} style={{ borderBottom: "1px solid #21262d", paddingBottom: 6 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontFamily: "var(--font-mono)", color: "#ffab70", fontWeight: 600 }}>{p.key}</span>
                          <span style={{ fontSize: "10px", color: "#8b949e", background: "#21262d", padding: "1px 4px", borderRadius: 3 }}>
                            {p.key === "page" || p.key === "limit" ? "integer" : "string"}
                          </span>
                        </div>
                        <p style={{ color: "#8b949e", fontSize: "11.5px", marginTop: 2 }}>{p.description || "Filtered query parameter."}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Responses Doc */}
              <div>
                <h4 style={{ color: "#c9d1d9", fontWeight: 600, marginBottom: 8, fontSize: "12px" }}>Responses</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activeTab.responsesDoc.map((res) => (
                    <div key={res.status} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 6, background: "#161b22", borderRadius: 6 }}>
                      <span style={{
                        color: res.status >= 200 && res.status < 300 ? "#22c55e" : "#ef4444",
                        fontWeight: "bold",
                        fontSize: "11px",
                        background: res.status >= 200 && res.status < 300 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        padding: "1px 4px",
                        borderRadius: 3
                      }}>
                        {res.status}
                      </span>
                      <div>
                        <div style={{ color: "#c9d1d9", fontWeight: 500, fontSize: "11.5px" }}>{res.name}</div>
                        <span style={{ color: "#8b949e", fontSize: "10.5px" }}>Returns schema: {res.schema || "object"}</span>
                      </div>
                    </div>
                  ))}
                  {activeTab.responsesDoc.length === 0 && (
                    <span style={{ color: "#8b949e", fontSize: "11.5px" }}>No responses documented for this endpoint.</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 24, borderTop: "1px solid #21262d", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10.5px", color: "#8b949e" }}>Last updated 2 days ago</span>
                <span style={{ fontSize: "11px", color: "#58a6ff", cursor: "pointer" }}>View in API docs ↗</span>
              </div>
            </div>
          </div>
        )}

        {/* Far Right Vertical Rail for Documentation Toggle */}
        {!docOpen && (
          <div style={{
            width: 32,
            background: "#08090b",
            borderLeft: "1px solid #1a1c24",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 12
          }}>
            <button
              onClick={() => setDocOpen(true)}
              style={{
                background: "none", border: "none", color: "#8b949e",
                writingMode: "vertical-rl", textOrientation: "mixed",
                cursor: "pointer", fontSize: "11px", fontWeight: 600,
                padding: "8px 0"
              }}
            >
              📄 Documentation
            </button>
          </div>
        )}

      </div>

      {/* 3. Bottom Status Bar */}
      <div style={{
        height: 30,
        background: "#0a0b0d",
        borderTop: "1px solid #1a1c24",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontSize: "11.5px",
        color: "#8b949e",
        userSelect: "none"
      }}>
        {/* Left Status Bar Items */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#27c93f", display: "inline-block" }} />
            <span>Online</span>
          </div>
          <span>Find and replace</span>
          <span>Console</span>
        </div>

        {/* Right Status Bar Items */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span>Runner</span>
          <span>Capture requests</span>
          <span>Auto-select agent</span>
          <span>Cookies</span>
          <span>Vault</span>
          <span>Trash</span>
        </div>
      </div>

      {/* 4. Save Request Modal Dialog Overlay */}
      {isSaveModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#0f1015",
            border: "1px solid #30363d",
            borderRadius: 12,
            width: 440,
            boxShadow: "0 12px 36px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1a1c24",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#f0f6fc" }}>Save Request</span>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8b949e",
                  fontSize: "16px",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Request Name Input */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "12px", color: "#8b949e", fontWeight: 500 }}>Request name</label>
                <input 
                  type="text"
                  value={saveModalReqName}
                  onChange={(e) => setSaveModalReqName(e.target.value)}
                  style={{
                    background: "#161b22",
                    border: "1px solid #21262d",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: "#c9d1d9",
                    outline: "none"
                  }}
                  placeholder="e.g. Get User details"
                />
              </div>

              {/* Folder Selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: "12px", color: "#8b949e", fontWeight: 500 }}>Select folder / collection</label>
                <select
                  value={saveModalFolderId}
                  onChange={(e) => setSaveModalFolderId(e.target.value)}
                  style={{
                    background: "#161b22",
                    border: "1px solid #21262d",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: "#c9d1d9",
                    outline: "none"
                  }}
                >
                  {collections.map(col => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                  <option value="__new_folder__">+ Create New Folder...</option>
                </select>
              </div>

              {/* Optional New Folder Name Input */}
              {saveModalFolderId === "__new_folder__" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: "12px", color: "#8b949e", fontWeight: 500 }}>New folder name</label>
                  <input 
                    type="text"
                    value={newFolderNameInput}
                    onChange={(e) => setNewFolderNameInput(e.target.value)}
                    style={{
                      background: "#161b22",
                      border: "1px solid #21262d",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontSize: "13px",
                      color: "#c9d1d9",
                      outline: "none"
                    }}
                    placeholder="e.g. Auth endpoints"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "14px 20px",
              background: "#0a0b0d",
              borderTop: "1px solid #1a1c24",
              display: "flex",
              justifyContent: "flex-end",
              gap: 12
            }}>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #30363d",
                  color: "#c9d1d9",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: "12.5px",
                  cursor: "pointer"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#161b22"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                Cancel
              </button>
              <button 
                onClick={executeSaveRequest}
                style={{
                  background: "#238636",
                  border: "1px solid #238636",
                  color: "#ffffff",
                  padding: "6px 16px",
                  borderRadius: 6,
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#2ea043"}
                onMouseLeave={e => e.currentTarget.style.background = "#238636"}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
