"use client";

import { useState } from "react";
import type { UserProfile } from "@/hooks/useProfile";
import { GraduationCap } from "lucide-react";

interface Props {
  onComplete: (profile: UserProfile) => Promise<void>;
  initialProfile?: UserProfile;
  /** BottomSheet内で使う場合はヘッダー・アイコンを省略 */
  compact?: boolean;
}

const FACULTIES = [
  "文学部", "教育学部", "法学部", "経済学部", "理学部",
  "医学部", "歯学部", "薬学部", "工学部", "農学部",
  "獣医学部", "水産学部", "大学院",
];

const QUESTIONS: { id: string; label: string }[] = [
  { id: "teaching",       label: "③ 教職・学芸員等の資格取得を目標としている" },
  { id: "grad_school",    label: "④ 大学院進学を希望している" },
  { id: "career_private", label: "⑤ 就職活動（民間企業）を予定している" },
  { id: "career_public",  label: "⑥ 就職活動（公務員・教員採用試験等）を予定している" },
  { id: "campus_event",   label: "⑦ 学内イベント・課外活動・サークルに関心がある" },
  { id: "off_event",      label: "⑧ 学外インターン・ボランティアに関心がある" },
];

export function Onboarding({ onComplete, initialProfile, compact }: Props) {
  const [faculty, setFaculty] = useState(initialProfile?.faculty ?? "");
  const [grade, setGrade] = useState(initialProfile?.grade ?? 1);
  const [isInternational, setIsInternational] = useState<boolean | null>(
    initialProfile != null ? initialProfile.is_international : null
  );
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!faculty) { setError("学部を選択してください"); return; }
    if (isInternational === null) { setError("留学生かどうかを選択してください"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onComplete({
        faculty,
        grade,
        interests,
        is_international: isInternational,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col bg-white ${compact ? "" : "h-full overflow-y-auto px-5 py-8"}`}>
      {!compact && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-hokudai-green/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-hokudai-green" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">プロフィール設定</h1>
            <p className="text-xs text-gray-500">あなたに関係する情報を優先表示します</p>
          </div>
        </div>
      )}

      {/* ① 学部 */}
      <div className="mb-5">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">① 学部・研究科</label>
        <div className="flex flex-wrap gap-2">
          {FACULTIES.map((f) => (
            <button
              key={f}
              onClick={() => setFaculty(f)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                faculty === f
                  ? "bg-hokudai-green text-white border-hokudai-green"
                  : "bg-white text-gray-600 border-gray-200 active:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ② 学年 */}
      <div className="mb-5">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">② 学年</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`w-10 h-10 rounded-xl text-sm font-medium border transition-colors ${
                grade === g
                  ? "bg-hokudai-green text-white border-hokudai-green"
                  : "bg-white text-gray-600 border-gray-200 active:bg-gray-50"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ③ 留学生 */}
      <div className="mb-5">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">
          ③ 留学生ですか？（Exchange / International student）
        </label>
        <div className="flex gap-3">
          {[
            { value: false, label: "いいえ（国内学生）" },
            { value: true,  label: "はい（留学生）" },
          ].map(({ value, label }) => (
            <button
              key={String(value)}
              onClick={() => setIsInternational(value)}
              className={`flex-1 py-2.5 rounded-xl text-sm border font-medium transition-colors ${
                isInternational === value
                  ? "bg-hokudai-green text-white border-hokudai-green"
                  : "bg-white text-gray-600 border-gray-200 active:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ④〜⑧ 関心質問 */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-gray-700 mb-3 block">あてはまるものを選択（複数可）</label>
        <div className="flex flex-col gap-2">
          {QUESTIONS.map((q) => {
            const checked = interests.includes(q.id);
            return (
              <button
                key={q.id}
                onClick={() => toggleInterest(q.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors ${
                  checked
                    ? "bg-hokudai-green/10 border-hokudai-green text-hokudai-green font-medium"
                    : "bg-white border-gray-200 text-gray-700 active:bg-gray-50"
                }`}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked ? "border-hokudai-green bg-hokudai-green" : "border-gray-300"
                }`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || !faculty || isInternational === null}
        className="w-full py-3 bg-hokudai-green text-white font-semibold rounded-2xl disabled:opacity-50 active:opacity-80 transition-opacity"
      >
        {submitting ? "保存中..." : initialProfile ? "プロフィールを更新する" : "設定を保存して始める"}
      </button>
    </div>
  );
}
