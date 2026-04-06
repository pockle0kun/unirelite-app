"use client";

import { useState, useEffect } from "react";
import type { UserProfile } from "@/lib/scoring";

export type { UserProfile };

const CACHE_KEY = "profile:v1";

function loadCache(): UserProfile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(p: UserProfile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(p));
  } catch {}
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cached = loadCache();
    if (cached) setProfile(cached);

    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setProfile(data);
          saveCache(data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveProfile = async (p: UserProfile): Promise<void> => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setProfile(data);
    saveCache(data);
  };

  return { profile, isLoading, saveProfile };
}
