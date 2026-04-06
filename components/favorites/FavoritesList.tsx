"use client";

import { useFavorites } from "@/hooks/useFavorites";
import { MailItem } from "@/components/mail/MailItem";
import { UnireItem } from "@/components/unire/UnireItem";
import { Star } from "lucide-react";

export function FavoritesList() {
  const { favorites } = useFavorites();

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
        <Star className="w-12 h-12" />
        <p className="text-sm">お気に入りがありません</p>
        <p className="text-xs text-center px-8">
          各お知らせの ☆ をタップして登録できます
        </p>
      </div>
    );
  }

  return (
    <div>
      {favorites.map((entry, i) => {
        if (entry.type === "gmail") {
          return <MailItem key={`gmail:${entry.data.id}`} message={entry.data} />;
        }
        return (
          <UnireItem
            key={`unire:${entry.data.id ?? i}`}
            item={entry.data}
          />
        );
      })}
    </div>
  );
}
