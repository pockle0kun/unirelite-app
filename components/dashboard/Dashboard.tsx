"use client";

import { useState } from "react";
import { useGuide, FlatGuide } from "@/hooks/useGuide";
import { useProfile } from "@/hooks/useProfile";
import { scoreAndSort, calculatePriorityScore } from "@/lib/scoring";
import { Onboarding } from "./Onboarding";
import { MailSkeletonList } from "@/components/mail/MailSkeleton";
import { ExternalLink, FileText, Clock, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ---- 締切バッジ ----

function daysLeft(endAt?: string): number | null {
  if (!endAt) return null;
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff < 0) return null;
  return Math.ceil(diff / (24 * 3600 * 1000));
}

function DeadlineBadge({ endAt }: { endAt?: string }) {
  const days = daysLeft(endAt);
  if (days === null) return null;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
      days <= 3 ? "bg-red-500 text-white" : "bg-amber-400 text-white"
    }`}>
      <Clock className="w-3 h-3" />
      あと{days}日
    </span>
  );
}

// ---- ダッシュボードカード ----

function DashboardCard({ guide, rank }: { guide: FlatGuide; rank: number }) {
  const href = guide.guideType === "Link" && guide.url
    ? guide.url
    : `https://unire.hokudai.ac.jp/view/guides/${guide.id}`;
  const days = daysLeft(guide.endAt);

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={`block p-4 rounded-2xl border transition-colors active:opacity-80 ${
        days !== null && days <= 3
          ? "bg-red-50 border-red-100"
          : days !== null && days <= 7
          ? "bg-amber-50 border-amber-100"
          : "bg-white border-gray-100 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 shrink-0">
          {guide.guideType === "Link"
            ? <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            : <FileText className="w-3.5 h-3.5 text-gray-400" />
          }
          <span className="text-xs text-gray-400 truncate max-w-[140px]">{guide.category}</span>
        </div>
        <DeadlineBadge endAt={guide.endAt} />
      </div>
      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
        {guide.title}
      </p>
      {guide.folderPath && (
        <p className="text-xs text-gray-400 mt-1 truncate">{guide.folderPath}</p>
      )}
    </motion.a>
  );
}

// ---- メイン ----

export function Dashboard({ enabled = true }: { enabled?: boolean }) {
  const { guides, isLoading: guidesLoading } = useGuide(enabled);
  const { profile, isLoading: profileLoading, saveProfile } = useProfile();
  const [showSettings, setShowSettings] = useState(false);

  const isLoading = guidesLoading || profileLoading;

  if (isLoading) return <MailSkeletonList count={5} />;

  // プロフィール未設定 or 設定画面表示
  if (!profile || showSettings) {
    return (
      <Onboarding
        onComplete={async (p) => {
          await saveProfile(p);
          setShowSettings(false);
        }}
      />
    );
  }

  const scored = scoreAndSort(guides, profile);
  const topItems = scored.filter((g) => calculatePriorityScore(g, profile) > 0).slice(0, 10);
  const urgentItems = scored.filter((g) => {
    const days = daysLeft(g.endAt);
    return days !== null && days <= 7;
  });

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">あなたへの重要情報</h2>
          <p className="text-xs text-gray-400">{profile.faculty} {profile.grade}年</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 active:bg-gray-50"
        >
          <Settings className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 締切アラート */}
      <AnimatePresence>
        {urgentItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mx-4 mb-3 p-3 bg-red-50 border border-red-200 rounded-2xl"
          >
            <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 締切間近 {urgentItems.length} 件
            </p>
            {urgentItems.slice(0, 3).map((g) => (
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* スコア付きカード */}
      {topItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-2">
          <p className="text-sm">関連するガイドが見つかりませんでした</p>
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs text-hokudai-green underline"
          >
            プロフィールを変更する
          </button>
        </div>
      ) : (
        <div className="px-4 pb-6 grid grid-cols-1 gap-3">
          {topItems.map((g, i) => (
            <DashboardCard key={g.id} guide={g} rank={i} />
          ))}
        </div>
      )}
    </div>
  );
}
