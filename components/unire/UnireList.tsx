"use client";

import { useUnire } from "@/hooks/useUnire";
import { UnireItem } from "./UnireItem";
import { MailSkeletonList } from "@/components/mail/MailSkeleton";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, WifiOff } from "lucide-react";

interface Props {
  enabled?: boolean;
  unireType?: string;
}

export function UnireList({ enabled = true, unireType }: Props) {
  const {
    items,
    allCount,
    currentPage,
    hasNextPage,
    hasPrevPage,
    isLoading,
    isLoadingMore,
    error,
    nextPage,
    prevPage,
  } = useUnire(enabled);

  if (isLoading) return <MailSkeletonList count={8} />;

  if (error) {
    if (error.includes("ELMS_NOT_CONFIGURED")) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 px-6">
          <WifiOff className="w-12 h-12 text-gray-300" />
          <p className="text-sm text-center font-medium text-gray-600">ELMSが未接続です</p>
          <p className="text-xs text-center text-gray-400">
            右上のアイコン →「ELMS接続」からCookieを設定してください
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <p className="text-sm text-center px-4">
          Unire の取得に失敗しました
          <br />
          <span className="text-xs">{error}</span>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
        <BookOpen className="w-12 h-12" />
        <p className="text-sm">お知らせがありません</p>
      </div>
    );
  }

  const pageStart = currentPage * 50 + 1;
  const pageEnd = pageStart + items.length - 1;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {items.map((item, i) => (
          <UnireItem key={item.id ?? i} item={item} />
        ))}
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={prevPage}
          disabled={!hasPrevPage}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 disabled:text-gray-300 active:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          前のページ
        </button>

        <span className="text-xs text-gray-400 tabular-nums">
          {`${pageStart}–${pageEnd} / ${allCount}件`}
        </span>

        <button
          onClick={nextPage}
          disabled={!hasNextPage || isLoadingMore}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 disabled:text-gray-300 active:bg-gray-100 rounded-lg transition-colors"
        >
          {isLoadingMore ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              次のページ
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
