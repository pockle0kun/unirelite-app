"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { LogOut, UserCircle, Pencil, Wifi, WifiOff } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { ElmsSetup } from "@/components/elms/ElmsSetup";

interface Props {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const INTEREST_LABELS: Record<string, string> = {
  teaching:       "教職・学芸員資格",
  grad_school:    "大学院進学",
  career_private: "就職（民間企業）",
  career_public:  "就職（公務員）",
  campus_event:   "学内イベント・課外活動",
  off_event:      "学外インターン・ボランティア",
  // 旧キー（後方互換）
  career:         "就職活動",
  international:  "留学・国際交流",
};

export function Header({ user }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [elmsSheetOpen, setElmsSheetOpen] = useState(false);
  const [elmsConnected, setElmsConnected] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { profile, saveProfile } = useProfile();

  useEffect(() => {
    fetch("/api/elms-credentials")
      .then((r) => r.json())
      .then((d) => setElmsConnected(d.connected ?? false))
      .catch(() => setElmsConnected(false));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const openProfile = () => {
    setMenuOpen(false);
    setProfileSheetOpen(true);
  };

  const openElms = () => {
    setMenuOpen(false);
    setElmsSheetOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-12 flex items-center justify-between">
        <h1 className="text-base font-bold text-hokudai-green tracking-tight">
          UnireLite
        </h1>

        {/* ユーザーアバター */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full overflow-hidden active:opacity-70 transition-opacity"
            aria-label="メニュー"
          >
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name ?? "User"} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-hokudai-green flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0] ?? "U"}
              </div>
            )}
          </button>

          {/* ドロップダウンメニュー */}
          {menuOpen && (
            <div className="absolute right-0 top-10 w-60 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30">
              {/* Googleアカウント情報 */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>

              {/* プロフィールサマリー */}
              <button
                onClick={openProfile}
                className="w-full text-left px-4 py-3 border-b border-gray-100 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <UserCircle className="w-3.5 h-3.5" />
                    プロフィール
                  </div>
                  <div className="flex items-center gap-1 text-xs text-hokudai-green">
                    <Pencil className="w-3 h-3" />
                    編集
                  </div>
                </div>

                {profile ? (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-700">
                      {profile.faculty}　{profile.grade}年
                      {profile.is_international && (
                        <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                          留学生
                        </span>
                      )}
                    </p>
                    {profile.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {profile.interests.map((id) => (
                          <span
                            key={id}
                            className="text-[10px] bg-hokudai-green/10 text-hokudai-green px-1.5 py-0.5 rounded-full"
                          >
                            {INTEREST_LABELS[id] ?? id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">未設定 — タップして登録</p>
                )}
              </button>

              {/* ELMS接続 */}
              <button
                onClick={openElms}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  {elmsConnected
                    ? <Wifi className="w-4 h-4 text-green-500" />
                    : <WifiOff className="w-4 h-4 text-gray-400" />
                  }
                  ELMS接続
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  elmsConnected
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {elmsConnected === null ? "…" : elmsConnected ? "接続済み" : "未接続"}
                </span>
              </button>

              {/* ログアウト */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 active:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          )}
        </div>
      </header>

      {/* プロフィール編集シート */}
      <BottomSheet
        open={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
        title="プロフィール設定"
      >
        <Onboarding
          compact
          onComplete={async (p) => {
            await saveProfile(p);
            setProfileSheetOpen(false);
          }}
          initialProfile={profile ?? undefined}
        />
      </BottomSheet>

      {/* ELMS接続シート */}
      <BottomSheet
        open={elmsSheetOpen}
        onClose={() => setElmsSheetOpen(false)}
        title="ELMS接続設定"
      >
        <ElmsSetup
          onConnected={() => {
            setElmsConnected(true);
            setElmsSheetOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}
