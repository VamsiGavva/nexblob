"use client";
import { useState } from "react";
import { parseJSON, formatJSON } from "@/lib/json-utils";

interface PostmanViewProps {
  activeBlobContent?: string;
  onCreateBlobWithContent?: (content: string, name?: string) => void;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface HeaderItem {
  key: string;
  value: string;
  enabled: boolean;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#10b981",
  POST: "#f59e0b",
  PUT: "#3b82f6",
  DELETE: "#ef4444",
  PATCH: "#8b5cf6",
};

export function PostmanView({ activeBlobContent = "{}", onCreateBlobWithContent }: PostmanViewProps) {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/todos/1");
  const [activeReqTab, setActiveReqTab] = useState<"params" | "headers" | "body">("body");
  
  // Headers state
  const [headers, setHeaders] = useState<HeaderItem[]>([
    { key: "Content-Type", value: "application/json", enabled: true },
    { key: "Accept", value: "application/json", enabled: true },
  ]);

  // Request Body state
  const [reqBody, setReqBody] = useState(activeBlobContent);
  const [urlParams, setUrlParams] = useState<{ key: string; value: string; enabled: boolean }[]>([
    { key: "", value: "", enabled: true },
  ]);

  // Response state
  const [isLoading, setIsLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseStatusText, setResponseStatusText] = useState<string>("");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseSize, setResponseSize] = useState<string | null>(null);
  const [resHeaders, setResHeaders] = useState<Record<string, string>>({});
  const [resBody, setResBody] = useState<string>("");
  const [resError, setResError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!url.trim()) {
      setResError("Please enter a valid request URL.");
      return;
    }

    setIsLoading(true);
    setResError(null);
    setResponseStatus(null);
    setResBody("");

    const startTime = performance.now();

    try {
      // Construct headers object
      const reqHeaders: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.enabled && h.key.trim()) {
          reqHeaders[h.key.trim()] = h.value;
        }
      });

      // Construct URL with query parameters
      let targetUrl = url.trim();
      const enabledParams = urlParams.filter((p) => p.enabled && p.key.trim());
      if (enabledParams.length > 0) {
        const u = new URL(targetUrl);
        enabledParams.forEach((p) => u.searchParams.append(p.key.trim(), p.value));
        targetUrl = u.toString();
      }

      const options: RequestInit = {
        method,
        headers: reqHeaders,
      };

      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && reqBody.trim()) {
        options.body = reqBody;
      }

      const res = await fetch(targetUrl, options);
      const endTime = performance.now();

      setResponseStatus(res.status);
      setResponseStatusText(res.statusText || (res.status === 200 ? "OK" : "Status"));
      setResponseTime(Math.round(endTime - startTime));

      // Capture headers
      const resHeaderObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaderObj[key] = val;
      });
      setResHeaders(resHeaderObj);

      // Read response body
      const text = await res.text();
      setResponseSize(`${(new TextEncoder().encode(text).length / 1024).toFixed(2)} KB`);

      // Try formatting if valid JSON
      try {
        const parsed = JSON.parse(text);
        setResBody(formatJSON(parsed));
      } catch {
        setResBody(text);
      }
    } catch (err) {
      setResError((err as Error).message || "Failed to send request.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadActiveBlob = () => {
    setReqBody(activeBlobContent);
  };

  const handleSaveResponseAsBlob = () => {
    if (resBody && onCreateBlobWithContent) {
      const urlHost = new URL(url).hostname || "API Response";
      onCreateBlobWithContent(resBody, `Response ${urlHost}`);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--surface)" }}>
      {/* Top Request Bar */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)", display: "flex", gap: 10, alignItems: "center" }}>
        {/* Method Select */}
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          style={{
            background: "var(--surface)",
            color: METHOD_COLORS[method],
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border-strong)",
            outline: "none",
            cursor: "pointer",
          }}
          id="postman-method-select"
        >
          {(["GET", "POST", "PUT", "DELETE", "PATCH"] as HttpMethod[]).map((m) => (
            <option key={m} value={m} style={{ color: METHOD_COLORS[m], fontWeight: 700 }}>
              {m}
            </option>
          ))}
        </select>

        {/* URL Input */}
        <input
          id="postman-url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Enter request URL (e.g. https://api.example.com/v1/data)"
          style={{
            flex: 1,
            background: "var(--surface)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            padding: "8px 14px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            outline: "none",
          }}
        />

        {/* Send Button */}
        <button
          id="postman-send-btn"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={isLoading}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: METHOD_COLORS[method],
            border: "none",
            color: "#fff",
            boxShadow: `0 2px 8px ${METHOD_COLORS[method]}40`,
          }}
        >
          {isLoading ? "Sending…" : "Send 🚀"}
        </button>
      </div>

      {/* Main Split Body: Request (Top half) & Response (Bottom half) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Request Config Section */}
        <div style={{ flex: "0 0 45%", display: "flex", flexDirection: "column", borderBottom: "2px solid var(--border)", overflow: "hidden" }}>
          {/* Request Sub-tabs */}
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)", padding: "0 12px" }}>
            {(["body", "headers", "params"] as const).map((t) => (
              <button
                key={t}
                id={`postman-req-tab-${t}`}
                className={`view-pill ${activeReqTab === t ? "active" : ""}`}
                onClick={() => setActiveReqTab(t)}
                style={{
                  borderRadius: 0,
                  borderBottom: activeReqTab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
            {activeReqTab === "body" && (
              <button
                id="postman-sync-blob-btn"
                className="btn btn-ghost"
                onClick={handleLoadActiveBlob}
                style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", color: "var(--accent)" }}
                title="Fill request body with current active JSON blob"
              >
                Sync Active Blob JSON
              </button>
            )}
          </div>

          {/* Request Tab Contents */}
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {activeReqTab === "body" && (
              <textarea
                id="postman-req-body"
                value={reqBody}
                onChange={(e) => setReqBody(e.target.value)}
                placeholder='{\n  "name": "NexBlob",\n  "type": "API Client"\n}'
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: 120,
                  background: "var(--surface-sunken)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  padding: 12,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  outline: "none",
                  resize: "none",
                }}
              />
            )}

            {activeReqTab === "headers" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {headers.map((h, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => {
                        const copy = [...headers];
                        copy[idx].enabled = e.target.checked;
                        setHeaders(copy);
                      }}
                    />
                    <input
                      placeholder="Header key (e.g. Authorization)"
                      value={h.key}
                      onChange={(e) => {
                        const copy = [...headers];
                        copy[idx].key = e.target.value;
                        setHeaders(copy);
                      }}
                      style={{ flex: 1, padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
                    />
                    <input
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => {
                        const copy = [...headers];
                        copy[idx].value = e.target.value;
                        setHeaders(copy);
                      }}
                      style={{ flex: 1, padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                      style={{ padding: "2px 6px", fontSize: 12, color: "var(--danger)" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  onClick={() => setHeaders([...headers, { key: "", value: "", enabled: true }])}
                  style={{ fontSize: 12, alignSelf: "flex-start", marginTop: 4 }}
                >
                  + Add Header
                </button>
              </div>
            )}

            {activeReqTab === "params" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {urlParams.map((p, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => {
                        const copy = [...urlParams];
                        copy[idx].enabled = e.target.checked;
                        setUrlParams(copy);
                      }}
                    />
                    <input
                      placeholder="Parameter key"
                      value={p.key}
                      onChange={(e) => {
                        const copy = [...urlParams];
                        copy[idx].key = e.target.value;
                        setUrlParams(copy);
                      }}
                      style={{ flex: 1, padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
                    />
                    <input
                      placeholder="Value"
                      value={p.value}
                      onChange={(e) => {
                        const copy = [...urlParams];
                        copy[idx].value = e.target.value;
                        setUrlParams(copy);
                      }}
                      style={{ flex: 1, padding: "4px 8px", fontSize: 12, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={() => setUrlParams(urlParams.filter((_, i) => i !== idx))}
                      style={{ padding: "2px 6px", fontSize: 12, color: "var(--danger)" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  onClick={() => setUrlParams([...urlParams, { key: "", value: "", enabled: true }])}
                  style={{ fontSize: 12, alignSelf: "flex-start", marginTop: 4 }}
                >
                  + Add Parameter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Response Panel Section */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
          {/* Response Meta Bar */}
          <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)", display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Response</span>

            {responseStatus !== null && (
              <span
                className={`badge ${responseStatus >= 200 && responseStatus < 300 ? "badge-success" : "badge-warning"}`}
                style={{ fontSize: 12, padding: "2px 8px" }}
              >
                {responseStatus} {responseStatusText}
              </span>
            )}

            {responseTime !== null && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                ⏱ {responseTime} ms
              </span>
            )}

            {responseSize !== null && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                📦 {responseSize}
              </span>
            )}

            {resBody && onCreateBlobWithContent && (
              <button
                id="postman-save-as-blob-btn"
                className="btn btn-ghost"
                onClick={handleSaveResponseAsBlob}
                style={{ marginLeft: "auto", fontSize: 12, color: "var(--accent)", padding: "2px 8px" }}
              >
                Save as JSON Blob 💾
              </button>
            )}
          </div>

          {/* Response Tabs & Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {resError ? (
              <div style={{ padding: 16, color: "var(--danger)", background: "var(--surface-sunken)", borderRadius: 8, fontSize: 13, border: "1px solid var(--border)" }}>
                ⚠️ Request Failed: {resError}
              </div>
            ) : responseStatus === null ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Click <strong>Send 🚀</strong> to execute API request and inspect JSON response.
              </div>
            ) : (
              <pre
                id="postman-res-body-display"
                style={{
                  margin: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {resBody}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

