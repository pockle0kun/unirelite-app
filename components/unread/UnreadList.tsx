"use client";

import { useGmail } from "@/hooks/useGmail";
import { useUnire } from "@/hooks/useUnire";
import { MailItem } from "@/components/mail/MailItem";
import { UnireItem } from "@/components/unire/UnireItem";
import { MailSkeletonList } from "@/components/mail/MailSkeleton";
import { Inbox } from "lucide-react";

interface Props {
  enabled?: boolean;
}

export function UnreadList({ enabled = true }: Props) {
  const { messages, isLoading: gmailLoading } = useGmail("is:unread", enabled);
  const { allItems, isLoading: unireLoading } = useUnire(enabled);

  const unreadElms = allItems.filter((item) => !item.isRead && item._source === "elms");

  const isLoading = gmailLoading || unireLoading;

  if (isLoading) return <MailSkeletonList count={8} />;

  const hasContent = messages.length > 0 || unreadElms.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
        <Inbox className="w-12 h-12" />
        <p className="text-sm">未読はありません</p>
      </div>
    );
  }

  return (
    <div>
      {messages.length > 0 && (
        <>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Gmail — {messages.length}件
            </p>
          </div>
          {messages.map((msg) => (
            <MailItem key={msg.id} message={msg} />
          ))}
        </>
      )}

      {unreadElms.length > 0 && (
        <>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              ELMS — {unreadElms.length}件
            </p>
          </div>
          {unreadElms.map((item, i) => (
            <UnireItem key={item.id ?? i} item={item} />
          ))}
        </>
      )}
    </div>
  );
}
