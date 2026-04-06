"use client";

import { useState } from "react";
import { useGuide, FlatGuide } from "@/hooks/useGuide";
import { useProfile } from "@/hooks/useProfile";
import { MailSkeletonList } from "@/components/mail/MailSkeleton";
import { ChevronLeft, ExternalLink, FileText, Clock, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---- ユーティリティ ----

const CATEGORY_ICONS: Record<string, string> = {
  "授業・履修": "📚",
  "学費・経済支援": "💴",
  "学籍・卒業・進級・学位": "🎓",
  "学生生活": "🏫",
  "資格関係": "📜",
  "キャリア": "💼",
  "国際交流・留学": "✈️",
  "留学生向け情報": "🌏",
  "その他": "📋",
};

function categoryIcon(name: string): string {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (name.includes(key) || key.includes(name)) return icon;
  }
  return "📁";
}

function daysLeft(endAt?: string): number | null {
  if (!endAt) return null;
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff < 0) return null;
  return Math.ceil(diff / (24 * 3600 * 1000));
}

function DeadlineBadge({ endAt }: { endAt?: string }) {
  const days = daysLeft(endAt);
  if (days === null) return null;
  const urgent = days <= 3;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${
      urgent ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
    }`}>
      <Clock className="w-3 h-3" />
      残{days}日
    </span>
  );
}

function DaysAgoBadge({ startAt }: { startAt?: string }) {
  if (!startAt) return null;
  const diff = Date.now() - new Date(startAt).getTime();
  if (diff < 0) return null;
  const days = Math.floor(diff / (24 * 3600 * 1000));
  if (days === 0) return (
    <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium shrink-0">今日</span>
  );
  if (days < 7) return (
    <span className="text-xs text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded-full shrink-0">{days}日前</span>
  );
  if (days < 30) return (
    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">{Math.floor(days / 7)}週前</span>
  );
  const months = Math.floor(days / 30);
  return (
    <span className="text-xs text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded-full shrink-0">{months}ヶ月前</span>
  );
}

// ---- ガイドアイテム ----

function GuideItem({ guide }: { guide: FlatGuide }) {
  const href = guide.guideType === "Link" && guide.url
    ? guide.url
    : `https://unire.hokudai.ac.jp/view/guides/${guide.id}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 bg-white active:bg-gray-50 transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-hokudai-green/10 flex items-center justify-center shrink-0 mt-0.5">
        {guide.guideType === "Link"
          ? <ExternalLink className="w-4 h-4 text-hokudai-green" />
          : <FileText className="w-4 h-4 text-hokudai-green" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium line-clamp-2 mb-1">
          {guide.title || "(タイトルなし)"}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <DaysAgoBadge startAt={guide.startAt} />
          <DeadlineBadge endAt={guide.endAt} />
          {guide.folderPath && (
            <p className="text-xs text-gray-400 truncate">{guide.folderPath}</p>
          )}
        </div>
      </div>
    </a>
  );
}

// ---- カテゴリグリッド ----

function CategoryGrid({
  categories,
  counts,
  onSelect,
}: {
  categories: string[];
  counts: Record<string, number>;
  onSelect: (cat: string) => void;
}) {
  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className="flex flex-col items-start gap-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:bg-gray-50 transition-colors text-left"
        >
          <span className="text-2xl">{categoryIcon(cat)}</span>
          <span className="text-sm font-medium text-gray-900 leading-tight">{cat}</span>
          <span className="text-xs text-gray-400">{counts[cat] ?? 0} 件</span>
        </button>
      ))}
    </div>
  );
}

// ---- カテゴリリスト ----

function CategoryList({
  category,
  guides,
  onBack,
}: {
  category: string;
  guides: FlatGuide[];
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-900">{categoryIcon(category)} {category}</p>
          <p className="text-xs text-gray-400">{guides.length} 件</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {guides.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-300 text-sm">
            コンテンツがありません
          </div>
        ) : (
          guides.map((g) => <GuideItem key={g.id} guide={g} />)
        )}
      </div>
    </div>
  );
}

// ---- メイン ----

export function GuideHub({ enabled = true }: { enabled?: boolean }) {
  const { guides, categories, urgent, isLoading, error } = useGuide(enabled);
  const { profile } = useProfile();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (isLoading) return <MailSkeletonList count={6} />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-sm text-center px-4">
          ガイドの取得に失敗しました<br />
          <span className="text-xs">{error}</span>
        </p>
      </div>
    );
  }

  // 非留学生には留学生向けカテゴリを非表示
  const isInternational = profile?.is_international ?? true; // プロフィール未設定時は表示
  const visibleCategories = categories.filter(
    (cat) => isInternational || !cat.includes("留学生")
  );
  const visibleGuides = guides.filter(
    (g) => isInternational || !g.category.includes("留学生")
  );

  const counts = visibleCategories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = visibleGuides.filter((g) => g.category === cat).length;
    return acc;
  }, {});

  const categoryGuides = selectedCategory
    ? visibleGuides.filter((g) => g.category === selectedCategory)
    : [];

  return (
    <div className="h-full overflow-hidden relative">
      <AnimatePresence mode="wait" initial={false}>
        {selectedCategory ? (
          <motion.div
            key="list"
            className="absolute inset-0 overflow-y-auto bg-gray-50"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
          >
            <CategoryList
              category={selectedCategory}
              guides={categoryGuides}
              onBack={() => setSelectedCategory(null)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="absolute inset-0 overflow-y-auto bg-gray-50"
            initial={{ x: "-30%" }}
            animate={{ x: 0 }}
            exit={{ x: "-30%" }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
          >
            {/* 締切間近バナー */}
            {urgent.length > 0 && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl">
                <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 締切間近
                </p>
                {urgent.slice(0, 3).map((g) => (
                  <a
                    key={g.id}
                    href={g.guideType === "Link" && g.url
                      ? g.url
                      : `https://unire.hokudai.ac.jp/view/guides/${g.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-1.5 gap-2"
                  >
                    <span className="text-sm text-gray-900 line-clamp-1 flex-1">{g.title}</span>
                    <DeadlineBadge endAt={g.endAt} />
                  </a>
                ))}
              </div>
            )}

            {/* カテゴリグリッド */}
            {visibleCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
                <BookOpen className="w-12 h-12" />
                <p className="text-sm">ガイドがありません</p>
              </div>
            ) : (
              <CategoryGrid
                categories={visibleCategories}
                counts={counts}
                onSelect={setSelectedCategory}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
