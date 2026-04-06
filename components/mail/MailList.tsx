"use client";

import { useGmail } from "@/hooks/useGmail";
import { MailItem } from "./MailItem";
import { MailSkeletonList } from "./MailSkeleton";
import { RefreshCw, Inbox, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Props {
  query: string;
  enabled?: boolean;
}

export function MailList({ query, enabled = true }: Props) {
  const {
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
  } = useGmail(query, enabled);

  if (isLoading) {
    return <MailSkeletonList count={8} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
        <p className="text-sm">{error}</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 text-sm text-blue-500 active:opacity-70"
        >
          <RefreshCw className="w-4 h-4" />
          再試行
        </button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
        <Inbox className="w-12 h-12" />
        <p className="text-sm">メールがありません</p>
      </div>
    );
  }

  const pageStart = currentPage * 50 + 1;
  const pageEnd = pageStart + messages.length - 1;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {messages.map((msg) => (
          <MailItem key={msg.id} message={msg} />
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
          {pageStart}–{pageEnd}件
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
