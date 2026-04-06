"use client";

import { useState, useEffect, useCallback } from "react";

export interface CustomTab {
  id: string;      // "custom-<uuid>" — Tab.id として使用
  dbId: string;    // Supabase の uuid
  label: string;
  query: string;
}

export function useCustomTabs() {
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTabs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tabs");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTabs(
        (data as Array<{ id: string; label: string; query: string }>).map(
          (row) => ({
            id: `custom-${row.id}`,
            dbId: row.id,
            label: row.label,
            query: row.query,
          })
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "タブの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  const addTab = async (label: string, query: string): Promise<void> => {
    const res = await fetch("/api/tabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, query }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await fetchTabs();
  };

  const removeTab = async (dbId: string): Promise<void> => {
    const res = await fetch(`/api/tabs?id=${encodeURIComponent(dbId)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    await fetchTabs();
  };

  return { tabs, isLoading, error, addTab, removeTab };
}
