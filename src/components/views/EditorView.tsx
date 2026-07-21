"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView as CMEditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { TreeView } from "@/components/editor/TreeView";
import { formatJSON } from "@/lib/json-utils";
import type { ParseResult } from "@/lib/types";

interface EditorViewProps {
  content: string;
  onChange: (value: string) => void;
  parsed: ParseResult;
  isReadOnly?: boolean;
}

export function EditorView({ content, onChange, parsed, isReadOnly = false }: EditorViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const cmView = useRef<CMEditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFormat = useCallback(() => {
    if (parsed.data) {
      try {
        const formatted = formatJSON(parsed.data);
        onChange(formatted);
      } catch (err) {
        alert("Failed to format: " + (err as Error).message);
      }
    } else if (parsed.error) {
      alert("Cannot format: Invalid JSON structure (" + parsed.error + ")");
    }
  }, [parsed.data, parsed.error, onChange]);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text !== undefined) {
        onChange(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isReadOnly) return;
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = CMEditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        history(),
        json(),
        oneDark,
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
        EditorState.readOnly.of(isReadOnly),
        CMEditorView.editable.of(!isReadOnly),
        CMEditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { fontFamily: "var(--font-mono)", overflow: "auto" },
          ".cm-content": { padding: "16px 0" },
        }),
      ],
    });

    const view = new CMEditorView({ state, parent: editorRef.current });
    cmView.current = view;

    return () => {
      view.destroy();
      cmView.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly]);


  // Keep editor in sync when content changes externally
  useEffect(() => {
    const view = cmView.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      });
    }
  }, [content]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!isReadOnly) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%", position: "relative" }}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,.txt,.csv,.yaml,.yml"
        style={{ display: "none" }}
        id="import-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
      />

      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(108, 92, 231, 0.15)",
            border: "2px dashed var(--accent)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            backdropFilter: "blur(2px)"
          }}
        >
          <div style={{ background: "var(--surface)", padding: "12px 24px", borderRadius: 12, fontWeight: 600, color: "var(--accent-ink)", boxShadow: "var(--shadow-md)" }}>
            📂 Drop JSON file to import into editor
          </div>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
        borderBottom: "1px solid var(--border)", background: "var(--surface-sunken)", flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Raw editor</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button
            id="import-file-btn"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "3px 8px" }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isReadOnly}
          >
            Import File
          </button>
          <button id="format-btn" className="btn btn-ghost" style={{ fontSize: 12, padding: "3px 8px" }} onClick={handleFormat}>
            Format
          </button>
        </div>
      </div>
      <div ref={editorRef} style={{ flex: 1, overflow: "hidden" }} />
    </div>
  );
}

interface TreePanelProps {
  parsed: ParseResult;
}

export function TreePanel({ parsed }: TreePanelProps) {
  const [selectedPath, setSelectedPath] = useState<string>("");

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--surface)" }}>
      <div style={{
        padding: "6px 12px", borderBottom: "1px solid var(--border)",
        background: "var(--surface-sunken)", flexShrink: 0, display: "flex", alignItems: "center"
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Tree view</span>
        {selectedPath && (
          <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 8, fontFamily: "var(--font-mono)" }}>
            {selectedPath}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {parsed.error ? (
          <div style={{ padding: 16, color: "var(--danger)", fontSize: 13 }}>
            {parsed.error}
          </div>
        ) : (
          <TreeView
            data={parsed.data}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        )}
      </div>
    </div>
  );
}
