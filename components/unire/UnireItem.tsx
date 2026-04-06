"use client";

import { useState } from "react";
import type { UnireItem as UnireItemType, UnireAttachment } from "@/hooks/useUnire";
import { BookOpen, ExternalLink, FileText, Download, Star, Tag } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useFavorites } from "@/hooks/useFavorites";
import { useLabels, mkItemKey } from "@/hooks/useLabels";
import { LabelBadge } from "@/components/labels/LabelBadge";
import { LabelPicker } from "@/components/labels/LabelPicker";

interface Props {
  item: UnireItemType;
}

function formatUnireDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

function AttachmentView({ attachments }: { attachments: UnireAttachment[] }) {
  const images = attachments.filter((a) =>
    /\.(jpe?g|png|gif|webp)$/i.test(a.fileName)
  );
  const files = attachments.filter(
    (a) => !/\.(jpe?g|png|gif|webp)$/i.test(a.fileName)
  );

  return (
    <div className="mt-4 space-y-3">
      {images.map((a) => (
        <div key={a.id} className="rounded-lg overflow-hidden border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.dataUrl} alt={a.fileName} className="w-full h-auto" />
          <p className="text-xs text-gray-400 px-2 py-1 bg-gray-50">{a.fileName}</p>
        </div>
      ))}
      {files.map((a) => (
        <a
          key={a.id}
          href={a.dataUrl}
          download={a.fileName}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 active:bg-gray-100 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <FileText className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm text-gray-700 flex-1 truncate">{a.fileName}</span>
          <Download className="w-4 h-4 text-gray-400 shrink-0" />
        </a>
      ))}
    </div>
  );
}

/** HTMLのimgタグsrcをプロキシURLに書き換える */
function proxyImages(html: string): string {
  return html.replace(
    /(<img[^>]+src=["'])([^"']+)(["'])/gi,
    (_, pre, src, post) => {
      try {
        const url = new URL(src, "https://unire.hokudai.ac.jp");
        if (url.hostname.endsWith("hokudai.ac.jp")) {
          return `${pre}/api/unire-image?url=${encodeURIComponent(url.toString())}${post}`;
        }
      } catch {}
      return `${pre}${src}${post}`;
    }
  );
}

/** HTMLかどうか判定 */
function isHtmlBody(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body);
}

export function UnireItem({ item }: Props) {
  const [open, setOpen] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);

  const { isFavorite, toggle } = useFavorites();
  const starred = isFavorite("unire", item.id ?? "");

  const { getItemLabels } = useLabels();
  const key = mkItemKey("unire", item.id ?? "");
  const itemLabels = getItemLabels(key);

  const title = item.title ?? "(タイトルなし)";
  const course = item.groupName ?? item.groupId ?? "";
  const dateStr = formatUnireDate(item.startAt);
  const rawBody = (item.body as string | undefined) ?? "";
  const attachments = item.attachments ?? [];

  const isHtml = isHtmlBody(rawBody);
  const processedBody = isHtml ? proxyImages(rawBody) : rawBody;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-100 bg-white active:bg-gray-50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-hokudai-green/10 flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen className="w-5 h-5 text-hokudai-green" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className="text-sm font-medium text-gray-700 truncate">
              {course}
            </span>
            {dateStr && (
              <span className="text-xs text-gray-400 shrink-0">{dateStr}</span>
            )}
          </div>

          {/* ラベル */}
          {itemLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {itemLabels.map((l) => (
                <LabelBadge key={l.id} label={l} small />
              ))}
            </div>
          )}

          <p className="text-sm text-gray-900 font-medium line-clamp-2">
            {title}
          </p>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle({ type: "unire", savedAt: Date.now(), data: item });
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

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex items-center justify-between mb-1">
          {course && (
            <p className="text-xs font-medium text-hokudai-green">{course}</p>
          )}
          {item.id && (
            <a
              href={
                item._source === "distributions"
                  ? `https://unire.hokudai.ac.jp/view/homeDistributions/${item.id}`
                  : `https://unire.hokudai.ac.jp/view/detailElmsInformations/${item.id}?information-type=elms-information`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-500 shrink-0 ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
              Unireで開く
            </a>
          )}
        </div>
        {dateStr && (
          <p className="text-xs text-gray-400 mb-4">{dateStr}</p>
        )}
        {processedBody && (
          isHtml ? (
            <div
              className="text-sm text-gray-800 leading-relaxed unire-body"
              dangerouslySetInnerHTML={{ __html: processedBody }}
            />
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {processedBody}
            </p>
          )
        )}
        {attachments.length > 0 && (
          <AttachmentView attachments={attachments} />
        )}
      </BottomSheet>
    </>
  );
}
