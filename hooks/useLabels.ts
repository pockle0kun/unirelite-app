"use client";

import {
  useState,
  useCallback,
  createContext,
  useContext,
  ReactNode,
  createElement,
} from "react";

export interface Label {
  id: string;
  name: string;
  color: string; // hex e.g. "#EF4444"
}

const LABELS_KEY = "labels:v1";
const ASSIGNMENTS_KEY = "label-assignments:v1";

function loadLabels(): Label[] {
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    return raw ? (JSON.parse(raw) as Label[]) : [];
  } catch {
    return [];
  }
}

function loadAssignments(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function persistLabels(labels: Label[]) {
  try {
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
  } catch {}
}

function persistAssignments(a: Record<string, string[]>) {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(a));
  } catch {}
}

interface LabelsCtx {
  labels: Label[];
  addLabel: (name: string, color: string) => void;
  removeLabel: (id: string) => void;
  getItemLabels: (key: string) => Label[];
  toggleAssignment: (key: string, labelId: string) => void;
  isAssigned: (key: string, labelId: string) => boolean;
}

const Ctx = createContext<LabelsCtx | null>(null);

export function LabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Label[]>(() => loadLabels());
  const [assignments, setAssignments] = useState<Record<string, string[]>>(
    () => loadAssignments()
  );

  const addLabel = useCallback((name: string, color: string) => {
    const id =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setLabels((prev) => {
      const next = [...prev, { id, name, color }];
      persistLabels(next);
      return next;
    });
  }, []);

  const removeLabel = useCallback((id: string) => {
    setLabels((prev) => {
      const next = prev.filter((l) => l.id !== id);
      persistLabels(next);
      return next;
    });
    setAssignments((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).map(([k, ids]) => [
          k,
          ids.filter((i) => i !== id),
        ])
      );
      persistAssignments(next);
      return next;
    });
  }, []);

  const toggleAssignment = useCallback((key: string, labelId: string) => {
    setAssignments((prev) => {
      const cur = prev[key] ?? [];
      const next = {
        ...prev,
        [key]: cur.includes(labelId)
          ? cur.filter((i) => i !== labelId)
          : [...cur, labelId],
      };
      persistAssignments(next);
      return next;
    });
  }, []);

  const getItemLabels = useCallback(
    (key: string): Label[] => {
      const ids = assignments[key] ?? [];
      return ids
        .map((id) => labels.find((l) => l.id === id))
        .filter(Boolean) as Label[];
    },
    [labels, assignments]
  );

  const isAssigned = useCallback(
    (key: string, labelId: string): boolean =>
      (assignments[key] ?? []).includes(labelId),
    [assignments]
  );

  return createElement(
    Ctx.Provider,
    { value: { labels, addLabel, removeLabel, getItemLabels, toggleAssignment, isAssigned } },
    children
  );
}

export function useLabels(): LabelsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLabels must be inside LabelsProvider");
  return ctx;
}

/** アイテムキー生成 */
export function mkItemKey(
  type: "gmail" | "unire",
  id: string | number
): string {
  return `${type}:${id}`;
}
