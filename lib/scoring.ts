import type { FlatGuide } from "@/app/api/guide/route";

export interface UserProfile {
  faculty: string;
  grade: number;
  interests: string[];
  is_international: boolean;
}

// カテゴリ名と関心タグのマッピング
const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  teaching:       ["資格関係", "Qualification", "教職", "学芸員"],
  grad_school:    ["大学院", "研究", "Graduate"],
  career_private: ["キャリア", "就職", "Career", "インターン", "民間"],
  career_public:  ["公務員", "教員採用", "行政", "国家試験", "キャリア", "就職"],
  campus_event:   ["学生生活", "Student Life", "イベント", "課外", "サークル"],
  off_event:      ["インターン", "ボランティア", "学外", "キャリア"],
  international:  ["国際交流・留学", "留学生向け情報", "International", "Foreigners", "留学"],
};

function daysUntilDeadline(endAt?: string): number | null {
  if (!endAt) return null;
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff < 0) return null;
  return Math.ceil(diff / (24 * 3600 * 1000));
}

export function calculatePriorityScore(guide: FlatGuide, profile: UserProfile): number {
  let score = 0;

  // 留学生でない場合は留学生向けカテゴリを除外
  if (
    !profile.is_international &&
    (guide.category.includes("留学生") || guide.category.includes("Foreigners"))
  ) {
    return -1;
  }

  // Tier 1 (+50): ユーザーの学部・属性と完全一致
  if (
    guide.category.includes(profile.faculty) ||
    profile.faculty.includes(guide.category)
  ) {
    score += 50;
  }

  // 留学生フラグ
  if (
    profile.is_international &&
    (guide.category.includes("留学生") || guide.category.includes("Foreigners"))
  ) {
    score += 50;
  }

  // Tier 2 (+30): 関心タグとカテゴリのマッチ
  for (const interest of profile.interests) {
    const keywords = INTEREST_CATEGORY_MAP[interest] ?? [];
    const matched = keywords.some(
      (kw) => guide.category.includes(kw) || guide.folderPath.includes(kw)
    );
    if (matched) {
      score += 30;
      break;
    }
  }

  // Urgency (+20): 締切7日以内
  const days = daysUntilDeadline(guide.endAt);
  if (days !== null && days <= 7) {
    score += Math.round(20 * (1 - days / 7));
  }

  return score;
}

export function scoreAndSort(guides: FlatGuide[], profile: UserProfile): FlatGuide[] {
  return [...guides]
    .map((g) => ({ guide: g, score: calculatePriorityScore(g, profile) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || (b.guide.endAt ?? "") < (a.guide.endAt ?? "") ? -1 : 1)
    .map((x) => x.guide);
}
