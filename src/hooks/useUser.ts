"use client";
import { useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export function useUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json() as { user: User | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return { user, loading, logout, refresh };
}
