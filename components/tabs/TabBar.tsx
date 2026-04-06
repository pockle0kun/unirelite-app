"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import type { Tab } from "@/lib/tabs";

interface Props {
  tabs: Tab[];
  activeIndex: number;
  customTabDbIds: Map<string, string>; // tabId → dbId
  onChange: (index: number) => void;
  onRemoveTab: (dbId: string) => void;
  onAddTab: () => void;
}

export function TabBar({
  tabs,
  activeIndex,
  customTabDbIds,
  onChange,
  onRemoveTab,
  onAddTab,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // アクティブタブが見切れないようにスクロール
  useEffect(() => {
    const el = tabRefs.current[activeIndex];
    const container = scrollRef.current;
    if (!el || !container) return;

    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const containerLeft = container.scrollLeft;
    const containerRight = containerLeft + container.offsetWidth;

    if (elLeft < containerLeft) {
      container.scrollTo({ left: elLeft - 16, behavior: "smooth" });
    } else if (elRight > containerRight) {
      container.scrollTo({
        left: elRight - container.offsetWidth + 16,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto scrollbar-none bg-white border-b border-gray-200"
    >
      {tabs.map((tab, i) => {
        const dbId = customTabDbIds.get(tab.id);
        const isCustom = !!dbId;

        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            onClick={() => onChange(i)}
            className={`relative flex items-center gap-1 px-4 py-3 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
              i === activeIndex
                ? "text-hokudai-green"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}

            {/* カスタムタブの削除ボタン */}
            {isCustom && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTab(dbId);
                }}
                className="w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors"
                aria-label={`${tab.label} を削除`}
              >
                <X className="w-3 h-3" />
              </span>
            )}

            {/* アクティブインジケーター */}
            {i === activeIndex && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-hokudai-green"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}

      {/* タブ追加ボタン */}
      <button
        onClick={onAddTab}
        className="flex items-center justify-center px-3 py-3 text-gray-400 hover:text-hokudai-green transition-colors shrink-0"
        aria-label="タブを追加"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
