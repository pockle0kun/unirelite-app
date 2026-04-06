"use client";

import { useState, useEffect, useRef } from "react";

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  internalDate: string;
  isUnread: boolean;
}

const PAGE_SIZE = 50;
const CACHE_TTL = 3 * 60 * 1000; // 3分

function readCache(
  key: string
): { messages: GmailMessage[]; nextToken: string | null } | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as { messages: GmailMessage[]; nextToken: string | null };
  } catch {
    return null;
  }
}

function writeCache(
  key: string,
  data: { messages: GmailMessage[]; nextToken: string | null }
) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

async function fetchPage(
  query: string,
  pageToken?: string
): Promise<{ messages: GmailMessage[]; nextToken: string | null }> {
  const params = new URLSearchParams({
    query,
    maxResults: String(PAGE_SIZE),
  });
  if (pageToken) params.set("pageToken", pageToken);
  const r = await fetch(`/api/gmail?${params}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error as string);
  return {
    messages: (data.messages ?? []) as GmailMessage[],
    nextToken: (data.nextPageToken ?? null) as string | null,
  };
}

export function useGmail(query: string, enabled = true) {
  const cacheKey = `gmail2:${query}`;

  // pages[i] = messages for page i
  const [pages, setPages] = useState<GmailMessage[][]>([]);
  // nextTokens[i] = pageToken to fetch pages[i+1]; null = no more
  const [nextTokens, setNextTokens] = useState<(string | null)[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const loadFirst = async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const result = await fetchPage(query);
      setPages([result.messages]);
      setNextTokens([result.nextToken]);
      setCurrentPage(0);
      writeCache(cacheKey, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = readCache(cacheKey);
    if (cached) {
      setPages([cached.messages]);
      setNextTokens([cached.nextToken]);
      setIsLoading(false);
      // バックグラウンドで最新を取得
      loadFirst(false);
    } else {
      loadFirst(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabled]);

  const nextPage = async () => {
    const nextIndex = currentPage + 1;
    if (pages[nextIndex]) {
      setCurrentPage(nextIndex);
      return;
    }
    const token = nextTokens[currentPage];
    if (!token) return;

    setIsLoadingMore(true);
    try {
      const result = await fetchPage(query, token);
      setPages((prev) => {
        const next = [...prev];
        next[nextIndex] = result.messages;
        return next;
      });
      setNextTokens((prev) => {
        const next = [...prev];
        next[nextIndex] = result.nextToken;
        return next;
      });
      setCurrentPage(nextIndex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const prevPage = () => setCurrentPage((p) => Math.max(0, p - 1));

  const refetch = () => {
    fetchedRef.current = false;
    setCurrentPage(0);
    loadFirst(true);
  };

  const messages = pages[currentPage] ?? [];
  const hasNextPage = !!nextTokens[currentPage];
  const hasPrevPage = currentPage > 0;

  return {
    messages,
    currentPage,
    hasNextPage,
    hasPrevPage,
    isLoading,
    isLoadingMore,
    error,
    nextPage,
    prevPage,
    refetch,
  };
}
