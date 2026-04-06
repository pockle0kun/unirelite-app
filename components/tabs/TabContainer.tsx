"use client";

import { useState, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TabBar } from "./TabBar";
import { AddTabModal } from "./AddTabModal";
import { MailList } from "@/components/mail/MailList";
import { UnireList } from "@/components/unire/UnireList";
import { GuideHub } from "@/components/guide/GuideHub";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { UnreadList } from "@/components/unread/UnreadList";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { DEFAULT_TABS } from "@/lib/tabs";
import { useCustomTabs } from "@/hooks/useCustomTabs";
import type { Tab } from "@/lib/tabs";

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "60%" : "-60%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir < 0 ? "60%" : "-60%",
    opacity: 0,
  }),
};

function TabPanel({
  tab,
  isActive,
  mounted,
}: {
  tab: Tab;
  isActive: boolean;
  mounted: boolean;
}) {
  if (!mounted) return null;

  return (
    <div className={isActive ? "block h-full" : "hidden"}>
      {tab.type === "gmail" || tab.type === "custom" ? (
        tab.query ? (
          <MailList query={tab.query} enabled={isActive || mounted} />
        ) : null
      ) : tab.type === "unire" ? (
        <UnireList enabled={isActive || mounted} unireType={tab.unireType ?? "elms"} />
      ) : tab.type === "guide" ? (
        <GuideHub enabled={isActive || mounted} />
      ) : tab.type === "dashboard" ? (
        <Dashboard enabled={isActive || mounted} />
      ) : tab.type === "unread" ? (
        <UnreadList enabled={isActive || mounted} />
      ) : tab.type === "favorites" ? (
        <FavoritesList />
      ) : null}
    </div>
  );
}

export function TabContainer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [mountedTabs, setMountedTabs] = useState<Set<number>>(
    () => new Set(DEFAULT_TABS.map((_, i) => i))
  );
  const [modalOpen, setModalOpen] = useState(false);

  const { tabs: customTabs, addTab, removeTab } = useCustomTabs();

  // DEFAULT_TABS + カスタムタブを結合
  const allTabs = useMemo(
    () => [
      ...DEFAULT_TABS,
      ...customTabs.map((ct) => ({
        id: ct.id,
        label: ct.label,
        type: "custom" as const,
        query: ct.query,
      })),
    ],
    [customTabs]
  );

  // tabId → dbId のマップ（TabBar でカスタムタブ判定に使用）
  const customTabDbIds = useMemo(
    () => new Map(customTabs.map((ct) => [ct.id, ct.dbId])),
    [customTabs]
  );

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const goTo = (index: number) => {
    if (index === activeIndex) return;
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
    setMountedTabs((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 50) return;
    if (dx < 0 && activeIndex < allTabs.length - 1) {
      goTo(activeIndex + 1);
    } else if (dx > 0 && activeIndex > 0) {
      goTo(activeIndex - 1);
    }
  };

  const handleRemoveTab = async (dbId: string) => {
    const removingIndex = allTabs.findIndex(
      (t) => customTabDbIds.get(t.id) === dbId
    );
    if (removingIndex === activeIndex && activeIndex > 0) {
      goTo(activeIndex - 1);
    } else if (removingIndex < activeIndex) {
      setActiveIndex((i) => i - 1);
    }
    await removeTab(dbId);
  };

  return (
    <div className="flex flex-col h-full">
      <TabBar
        tabs={allTabs}
        activeIndex={activeIndex}
        customTabDbIds={customTabDbIds}
        onChange={goTo}
        onRemoveTab={handleRemoveTab}
        onAddTab={() => setModalOpen(true)}
      />

      {/* スワイプ可能なコンテンツエリア */}
      <div
        className="flex-1 overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="absolute inset-0 overflow-y-auto"
          >
            {allTabs.map((tab, i) => (
              <TabPanel
                key={tab.id}
                tab={tab}
                isActive={i === activeIndex}
                mounted={mountedTabs.has(i)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <AddTabModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addTab}
      />
    </div>
  );
}
