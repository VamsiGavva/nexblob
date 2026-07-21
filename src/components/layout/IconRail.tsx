"use client";
import { useEffect, useState } from "react";
import type { ViewMode } from "@/lib/types";

interface IconRailProps {
  activeView: ViewMode;
  onChangeView: (v: ViewMode) => void;
}

export function IconRail({
  activeView, onChangeView
}: IconRailProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const navItems: { id: ViewMode; label: string; icon: string }[] = [
    { id: "editor", label: "Blob", icon: "{}" },
    { id: "diff", label: "Diff Check", icon: "⇄" },
    { id: "postman", label: "Postman", icon: "🚀" },
  ];

  return (
    <nav className="icon-rail" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div style={{ marginBottom: 20 }}>
        <div
          aria-label="NexBlob Logo"
          style={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: "0 0 12px rgba(108, 92, 231, 0.5)",
            border: "1px solid rgba(108, 92, 231, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0d0f17",
            cursor: "pointer"
          }}
        >
          <img
            src="/logo.png"
            alt="NexBlob"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center" }}>
        {navItems.map((item) => {
          const isBlobGroup = activeView !== "diff" && activeView !== "postman";
          const isActive = item.id === "editor" ? isBlobGroup : activeView === item.id;
          return (
            <button
              key={item.id}
              id={`rail-${item.id}`}
              className={`rail-btn ${isActive ? "active" : ""}`}
              aria-label={item.label}
              title={item.label}
              onClick={() => onChangeView(item.id)}
              style={{
                fontSize: item.id === "editor" ? 13 : 16,
                fontFamily: item.id === "editor" ? "var(--font-mono)" : undefined,
                position: "relative"
              }}
            >
              {item.icon}
              {isActive && (
                <div style={{
                  position: "absolute", left: 0, top: "25%", bottom: "25%", width: 3,
                  background: "var(--accent)", borderRadius: "0 4px 4px 0",
                  boxShadow: "0 0 8px var(--accent)"
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Spacer + Settings / Theme at bottom */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <button
          className="rail-btn"
          aria-label="Toggle light/dark theme"
          onClick={toggleTheme}
          style={{ fontSize: 16 }}
        >
          {theme === "dark" ? "☀" : "🌙"}
        </button>
        <button
          className="rail-btn"
          aria-label="User profile"
          style={{
            background: "var(--accent)", color: "#fff",
            borderRadius: "50%", fontWeight: 600, fontSize: 13,
            boxShadow: "0 2px 8px rgba(108, 92, 231, 0.4)"
          }}
        >
          V
        </button>
      </div>
    </nav>
  );
}
