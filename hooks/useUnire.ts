"use client";

import { useState, useEffect, useRef } from "react";

export interface UnireAttachment {
  id: string;
  fileName: string;
  dataUrl: string; // "data:{mime};base64,..."
}

export interface UnireItem {
  id?: string | number;
  title?: string;
  body?: string;
  startAt?: string;
  groupName?: string;
  groupId?: string;
  elmsImportantType?: string;
  isRead?: boolean;
  _source?: "elms" | "distributions";
  attachments?: UnireAttachment[];
  [key: string]: unknown;
}

const PAGE_SIZE = 50;
const FETCH_SIZE = 50;
const MAX_ITEMS = 500;
const CACHE_KEY = "unire:v5";
const CACHE_TTL_MS = 5 * 60 * 1000;

// ---- キャッシュ（添付ファイルは除外して容量節約）----

interface CacheEntry {
  allItems: UnireItem[];
  elmsFetchOffset: number;
  elmsExhausted: boolean;
  distFetchOffset: number;
  distExhausted: boolean;
  ts: number;
}

function loadCache(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function saveCache(entry: Omit<CacheEntry, "ts">) {
  try {
    // 添付ファイルデータ（base64）はキャッシュから除外
    const stripped: Omit<CacheEntry, "ts"> = {
      ...entry,
      allItems: entry.allItems.map(({ attachments: _a, ...item }) => item),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...stripped, ts: Date.now() }));
  } catch {}
}

// ---- データ変換ユーティリティ ----

type RawElmsItem = {
  elmsInformation?: Record<string, unknown>;
  isElmsInformationRead?: boolean;
  [key: string]: unknown;
};

type RawAttachment = {
  id: string;
  fileName: string;
  file: string;
  [key: string]: unknown;
};

type RawDistItem = {
  distributionBasicInfo?: Record<string, unknown>;
  distributionAttachedInfos?: RawAttachment[];
  category?: { name?: string; englishName?: string };
  childCategory?: { name?: string; englishName?: string };
  isDistributionRead?: boolean;
  isRead?: boolean;
  [key: string]: unknown;
};

/** base64 文字列から data URL を生成 */
function buildDataUrl(fileName: string, base64: string): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const mimes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  const mime = mimes[ext] ?? "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

/** HTML エンティティのデコードと&nbsp;を改行変換 */
function cleanText(text?: unknown): string {
  if (typeof text !== "string" || !text) return "";
  return text
    .replace(/&nbsp;/g, "\n")   // &nbsp; を段落区切りとして改行に
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function parseElmsItem(raw: RawElmsItem): UnireItem {
  if (raw.elmsInformation) {
    return {
      ...(raw.elmsInformation as UnireItem),
      isRead: raw.isElmsInformationRead,
      _source: "elms",
    };
  }
  return { ...(raw as UnireItem), _source: "elms" };
}

function parseDistItem(raw: RawDistItem): UnireItem {
  const info = (raw.distributionBasicInfo ?? raw) as Record<string, unknown>;
  const cat = raw.category;
  const child = raw.childCategory;

  // 日本語カテゴリ名を優先
  const catName = cat?.name ?? cat?.englishName ?? "";
  const childName = child?.name ?? child?.englishName ?? "";
  const groupName = childName ? `${catName} / ${childName}` : catName;

  // body は常に空。bodyNoTag にプレーンテキストが入る
  const body = cleanText(info.bodyNoTag) || cleanText(info.body);

  // 添付ファイルを data URL に変換
  const attachments: UnireAttachment[] = (raw.distributionAttachedInfos ?? [])
    .filter((a) => a.file)
    .map((a) => ({
      id: a.id,
      fileName: a.fileName,
      dataUrl: buildDataUrl(a.fileName, a.file),
    }));

  return {
    id: info.id as string | number | undefined,
    title: info.title as string | undefined,
    body,
    startAt: (info.startAt ?? info.publishDate) as string | undefined,
    groupName: groupName || undefined,
    isRead: raw.isDistributionRead ?? raw.isRead,
    _source: "distributions",
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

function parseRaw(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "data", "detailElmsInformations", "elmsInformations"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) return val as unknown[];
    }
  }
  return [];
}

function sortByDate(items: UnireItem[]): UnireItem[] {
  return [...items].sort((a, b) => {
    const da = a.startAt ? new Date(a.startAt).getTime() : 0;
    const db = b.startAt ? new Date(b.startAt).getTime() : 0;
    return db - da;
  });
}

// ---- API フェッチ ----

async function fetchBatch(
  type: "elms" | "distributions",
  skip: number
): Promise<{ items: UnireItem[]; rawCount: number }> {
  const res = await fetch(`/api/unire?type=${type}&skip=${skip}&take=${FETCH_SIZE}`);
  const data = await res.json();
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as Record<string, unknown>).error));
  }

  const raw = parseRaw(data);
  const items =
    type === "elms"
      ? raw.map((r) => parseElmsItem(r as RawElmsItem))
      : raw.map((r) => parseDistItem(r as RawDistItem));

  return { items, rawCount: raw.length };
}

// ---- Hook ----

export function useUnire(enabled = true) {
  const cacheRef = useRef<CacheEntry | null | undefined>(undefined);
  if (cacheRef.current === undefined) cacheRef.current = loadCache();
  const hit = cacheRef.current;

  const [allItems, setAllItems] = useState<UnireItem[]>(hit?.allItems ?? []);
  const [elmsFetchOffset, setElmsFetchOffset] = useState(hit?.elmsFetchOffset ?? 0);
  const [elmsExhausted, setElmsExhausted] = useState(hit?.elmsExhausted ?? false);
  const [distFetchOffset, setDistFetchOffset] = useState(hit?.distFetchOffset ?? 0);
  const [distExhausted, setDistExhausted] = useState(hit?.distExhausted ?? false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(!hit);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(!!hit);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    setIsLoading(true);
    Promise.all([fetchBatch("elms", 0), fetchBatch("distributions", 0)])
      .then(([elms, dist]) => {
        const merged = sortByDate([...elms.items, ...dist.items]);
        const newElmsExhausted = elms.rawCount === 0;
        const newDistExhausted = dist.rawCount === 0;

        setAllItems(merged);
        setElmsFetchOffset(elms.rawCount);
        setElmsExhausted(newElmsExhausted);
        setDistFetchOffset(dist.rawCount);
        setDistExhausted(newDistExhausted);
        saveCache({
          allItems: merged,
          elmsFetchOffset: elms.rawCount,
          elmsExhausted: newElmsExhausted,
          distFetchOffset: dist.rawCount,
          distExhausted: newDistExhausted,
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [enabled]);

  const nextPage = async () => {
    const nextIndex = currentPage + 1;
    const nextPageStart = nextIndex * PAGE_SIZE;

    if (allItems.length > nextPageStart) {
      setCurrentPage(nextIndex);
      return;
    }

    const bothExhausted = elmsExhausted && distExhausted;
    if (bothExhausted || allItems.length >= MAX_ITEMS) return;

    setIsLoadingMore(true);
    try {
      const fetches: Promise<{
        source: "elms" | "distributions";
        items: UnireItem[];
        rawCount: number;
      }>[] = [];
      if (!elmsExhausted)
        fetches.push(
          fetchBatch("elms", elmsFetchOffset).then((r) => ({ source: "elms" as const, ...r }))
        );
      if (!distExhausted)
        fetches.push(
          fetchBatch("distributions", distFetchOffset).then((r) => ({
            source: "distributions" as const,
            ...r,
          }))
        );

      const results = await Promise.all(fetches);
      let newElmsOffset = elmsFetchOffset;
      let newElmsExhausted = elmsExhausted;
      let newDistOffset = distFetchOffset;
      let newDistExhausted = distExhausted;
      const additional: UnireItem[] = [];

      for (const r of results) {
        additional.push(...r.items);
        if (r.source === "elms") {
          newElmsOffset += r.rawCount;
          newElmsExhausted = r.rawCount === 0;
        } else {
          newDistOffset += r.rawCount;
          newDistExhausted = r.rawCount === 0;
        }
      }

      const newAll = sortByDate([...allItems, ...additional]);
      setAllItems(newAll);
      setElmsFetchOffset(newElmsOffset);
      setElmsExhausted(newElmsExhausted);
      setDistFetchOffset(newDistOffset);
      setDistExhausted(newDistExhausted);
      saveCache({
        allItems: newAll,
        elmsFetchOffset: newElmsOffset,
        elmsExhausted: newElmsExhausted,
        distFetchOffset: newDistOffset,
        distExhausted: newDistExhausted,
      });

      if (newAll.length > nextPageStart) setCurrentPage(nextIndex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const prevPage = () => setCurrentPage((p) => Math.max(0, p - 1));

  const pageItems = allItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const bothExhausted = elmsExhausted && distExhausted;
  const hasNextPage =
    allItems.length > (currentPage + 1) * PAGE_SIZE ||
    (!bothExhausted && allItems.length < MAX_ITEMS);
  const hasPrevPage = currentPage > 0;

  return {
    items: pageItems,
    allItems,
    allCount: allItems.length,
    currentPage,
    hasNextPage,
    hasPrevPage,
    isLoading,
    isLoadingMore,
    error,
    nextPage,
    prevPage,
  };
}
