"use client";

import { useState, useEffect, useRef } from "react";
import type { FlatGuide } from "@/app/api/guide/route";

export type { FlatGuide };

const CACHE_KEY = "guide:v1";
const CACHE_TTL = 10 * 60 * 1000;

function loadCache(): FlatGuide[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function saveCache(data: FlatGuide[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function useGuide(enabled = true) {
  const [guides, setGuides] = useState<FlatGuide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = loadCache();
    if (cached) {
      setGuides(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch("/api/guide")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setGuides(data.guides ?? []);
        saveCache(data.guides ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [enabled]);

  // カテゴリ一覧（重複排除・ソート）
  const categories = Array.from(new Set(guides.map((g) => g.category))).sort();

  // 締切7日以内のガイド（優先度スコア順）
  const urgent = guides
    .filter((g) => {
      if (!g.endAt) return false;
      const diff = new Date(g.endAt).getTime() - Date.now();
      return diff > 0 && diff < 7 * 24 * 3600 * 1000;
    })
    .sort((a, b) => new Date(a.endAt!).getTime() - new Date(b.endAt!).getTime());

  return { guides, categories, urgent, isLoading, error };
}
