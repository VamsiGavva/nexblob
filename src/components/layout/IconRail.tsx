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
    { id: "editor", label: "Editor", icon: "✦" },
    { id: "table", label: "Table View", icon: "⊞" },
    { id: "raw", label: "Raw JSON", icon: "{}" },
    { id: "sql", label: "SQL Query", icon: "▷" },
    { id: "chart", label: "Charts", icon: "◉" },
    { id: "diff", label: "JSON Diff", icon: "⇄" },
    { id: "ai_page", label: "AI Specialist", icon: "◈" },
  ];

  return (
    <nav className="icon-rail" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div style={{ marginBottom: 20 }}>
        <button
          className="rail-btn"
          aria-label="NexBlob Logo"
          style={{
            color: "var(--accent)", fontSize: 20, fontWeight: 800,
            textShadow: "0 0 10px rgba(108, 92, 231, 0.4)",
            background: "var(--accent-bg)", borderRadius: "10px"
          }}
        >
          N
        </button>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "center" }}>
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`rail-${item.id}`}
              className={`rail-btn ${isActive ? "active" : ""}`}
              aria-label={item.label}
              onClick={() => onChangeView(item.id)}
              style={{
                fontSize: item.id === "raw" ? 11 : 16,
                fontFamily: item.id === "raw" ? "var(--font-mono)" : undefined,
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
