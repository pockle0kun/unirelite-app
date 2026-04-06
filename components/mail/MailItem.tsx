"use client";

import { useState } from "react";
import {
  parseSender,
  getInitials,
  getAvatarColor,
  formatMailDate,
} from "@/lib/mail";
import type { GmailMessage } from "@/hooks/useGmail";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ExternalLink, Star, Tag } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useLabels, mkItemKey } from "@/hooks/useLabels";
import { LabelBadge } from "@/components/labels/LabelBadge";
import { LabelPicker } from "@/components/labels/LabelPicker";

interface Props {
  message: GmailMessage;
}

export function MailItem({ message }: Props) {
  const [open, setOpen] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [isHtml, setIsHtml] = useState(false);
  const [loading, setLoading] = useState(false);

  const { isFavorite, toggle } = useFavorites();
  const starred = isFavorite("gmail", message.id);

  const { getItemLabels } = useLabels();
  const key = mkItemKey("gmail", message.id);
  const itemLabels = getItemLabels(key);

  const { name, email } = parseSender(message.from);
  const initials = getInitials(name || email);
  const avatarColor = getAvatarColor(email);
  const dateStr = formatMailDate(message.internalDate);

  const handleOpen = async () => {
    setOpen(true);
    if (body !== null) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/gmail/${message.id}`);
      const data = await res.json();
      setBody(data.body ?? "");
      setIsHtml(data.isHtml ?? false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-50 transition-colors ${
          message.isUnread ? "bg-white" : "bg-gray-50/50"
        }`}
      >
        {/* 送信者アバター */}
        <div
          className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center shrink-0 mt-0.5`}
        >
          <span className="text-white text-sm font-semibold leading-none">
            {initials}
          </span>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span
              className={`text-sm truncate ${
                message.isUnread
                  ? "font-semibold text-gray-900"
                  : "text-gray-600"
              }`}
            >
              {name || email}
            </span>
            <span className="text-xs text-gray-400 shrink-0 tabular-nums">
              {dateStr}
            </span>
          </div>

          {/* ラベル */}
          {itemLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {itemLabels.map((l) => (
                <LabelBadge key={l.id} label={l} small />
              ))}
            </div>
          )}

          <p
            className={`text-sm truncate ${
              message.isUnread
                ? "font-medium text-gray-900"
                : "text-gray-500"
            }`}
          >
            {message.subject || "(件名なし)"}
          </p>

          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
            {message.snippet}
          </p>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle({ type: "gmail", savedAt: Date.now(), data: message });
            }}
            className="p-1 rounded-full active:bg-gray-100 transition-colors"
          >
            <Star
              className={`w-4 h-4 ${
                starred ? "fill-amber-400 text-amber-400" : "text-gray-300"
              }`}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLabelPickerOpen(true);
            }}
            className="p-1 rounded-full active:bg-gray-100 transition-colors"
          >
            <Tag
              className={`w-4 h-4 ${
                itemLabels.length > 0 ? "text-hokudai-green" : "text-gray-300"
              }`}
            />
          </button>
        </div>
      </button>

      {/* ラベルピッカー */}
      <LabelPicker
        open={labelPickerOpen}
        onClose={() => setLabelPickerOpen(false)}
        itemKey={key}
      />

      {/* メール詳細 */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={message.subject || "(件名なし)"}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-700">{name || email}</p>
          <a
            href={`https://mail.google.com/mail/u/0/#all/${message.threadId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 shrink-0 ml-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            Gmailで開く
          </a>
        </div>
        <p className="text-xs text-gray-400 mb-4">{dateStr}</p>

        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {!loading && body !== null &&
          (isHtml ? (
            <div
              className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {body}
            </p>
          ))}
      </BottomSheet>
    </>
  );
}
