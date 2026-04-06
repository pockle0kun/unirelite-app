"use client";

import {
  useState,
  useCallback,
  createContext,
  useContext,
  ReactNode,
  createElement,
} from "react";
import type { GmailMessage } from "@/hooks/useGmail";
import type { UnireItem } from "@/hooks/useUnire";

export type FavoriteEntry =
  | { type: "gmail"; savedAt: number; data: GmailMessage }
  | { type: "unire"; savedAt: number; data: UnireItem };

type FavoritesMap = Record<string, FavoriteEntry>;

const STORAGE_KEY = "favorites:v1";

function load(): FavoritesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FavoritesMap) : {};
  } catch {
    return {};
  }
}

function persist(map: FavoritesMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function entryKey(
  type: "gmail" | "unire",
  id: string | number
): string {
  return `${type}:${id}`;
}

// ---- Context ----

interface FavoritesCtx {
  favorites: FavoriteEntry[];
  isFavorite: (type: "gmail" | "unire", id: string | number) => boolean;
  toggle: (entry: FavoriteEntry) => void;
}

const Ctx = createContext<FavoritesCtx | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<FavoritesMap>(() => load());

  const isFavorite = useCallback(
    (type: "gmail" | "unire", id: string | number) =>
      entryKey(type, id) in map,
    [map]
  );

  const toggle = useCallback((entry: FavoriteEntry) => {
    const id =
      entry.type === "gmail"
        ? entry.data.id
        : String(entry.data.id ?? "");
    const key = entryKey(entry.type, id);

    setMap((prev) => {
      const next = { ...prev };
      if (key in next) {
        delete next[key];
      } else {
        next[key] = { ...entry, savedAt: Date.now() };
      }
      persist(next);
      return next;
    });
  }, []);

  const favorites: FavoriteEntry[] = Object.values(map).sort(
    (a, b) => b.savedAt - a.savedAt
  );

  return createElement(Ctx.Provider, { value: { favorites, isFavorite, toggle } }, children);
}

export function useFavorites(): FavoritesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFavorites must be inside FavoritesProvider");
  return ctx;
}
