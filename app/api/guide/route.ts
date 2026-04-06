import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BASE = "https://unire.hokudai.ac.jp/api";
const THREE_YEARS_MS = 3 * 365 * 24 * 3600 * 1000;

export interface FlatGuide {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  folderPath: string;
  guideType: "Page" | "Link";
  url?: string;
  startAt?: string;
  endAt?: string;
  hasAttachments: boolean;
}

function authHeaders(): Record<string, string> {
  const cookie = process.env.UNIRE_ELMS_COOKIE;
  return {
    Referer: "https://unire.hokudai.ac.jp/",
    Cookie: `.AspNetCore.saml2=${cookie}; WAPID=${process.env.UNIRE_WAPID}`,
  };
}

async function unireFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

interface RawGuide {
  id: string;
  title?: string;
  englishTitle?: string;
  guideType?: string;
  url?: string;
  startAt?: string;
  endAt?: string;
  attachedInfos?: unknown[];
}

interface RawFolder {
  id?: string;
  name?: string;
  // contentFolderFamilies レスポンス形式: フォルダ名・IDはここに入る
  parentContentFolder?: { id?: string; name?: string };
  guides?: RawGuide[];
  contentFolderGuides?: RawGuide[];
  childContentFolders?: RawFolder[];
}

async function extractGuidesFromFolder(
  folder: RawFolder,
  categoryName: string,
  categoryId: string,
  folderPath: string,
  depth: number = 0
): Promise<FlatGuide[]> {
  const results: FlatGuide[] = [];

  const rawGuides: RawGuide[] = folder.guides ?? folder.contentFolderGuides ?? [];
  for (const g of rawGuides) {
    // 3年以上前のガイドはスキップ
    if (g.startAt) {
      const age = Date.now() - new Date(g.startAt).getTime();
      if (age > THREE_YEARS_MS) continue;
    }
    results.push({
      id: g.id,
      title: g.title ?? g.englishTitle ?? "",
      category: categoryName,
      categoryId,
      folderPath,
      guideType: (g.guideType as "Page" | "Link") ?? "Page",
      url: g.url,
      startAt: g.startAt,
      endAt: g.endAt,
      hasAttachments: Array.isArray(g.attachedInfos) && g.attachedInfos.length > 0,
    });
  }

  const children: RawFolder[] = folder.childContentFolders ?? [];
  if (children.length > 0 && depth < 4) {
    await Promise.all(
      children.map(async (child) => {
        const childId = child.id ?? child.parentContentFolder?.id;
        if (!childId) return;
        try {
          const childData = await unireFetch(
            `/ContentFolders/contentFolderFamily/${childId}`
          ) as RawFolder;
          const childName = child.name ?? child.parentContentFolder?.name ?? "";
          const childPath = folderPath ? `${folderPath} / ${childName}` : childName;
          const nested = await extractGuidesFromFolder(
            childData, categoryName, categoryId, childPath, depth + 1
          );
          results.push(...nested);
        } catch {
          // 取得できないフォルダはスキップ
        }
      })
    );
  }

  return results;
}

// ---- Unire に掲載されていない情報の補完リンク ----
// カテゴリ名 → 追加する外部リンク（ELMS Moodle / 公式サイト）
const STATIC_LINKS: FlatGuide[] = [
  // 学費・経済支援：民間財団奨学金は Unire ガイドに未登録 → Moodle データベースへ
  {
    id: "static-minkan-moodle",
    title: "民間財団・地方自治体奨学金（Moodle）",
    category: "学費・経済支援",
    categoryId: "01J6XCVKCGPH6BZE60ZAJTSNG9",
    folderPath: "民間財団・地方自治体奨学金",
    guideType: "Link",
    url: "https://moodle.elms.hokudai.ac.jp/mod/data/view.php?id=2557",
    hasAttachments: false,
  },
  // 学籍・卒業・進級・学位：Unire ガイドに未登録 → Moodle + 公式サイト
  {
    id: "static-gakuseki-moodle",
    title: "学籍・卒業・進級・学位（ELMS Moodle）",
    category: "学籍・卒業・進級・学位",
    categoryId: "01J6XCVKCHF2D2Q52WJBS0QXBJ",
    folderPath: "",
    guideType: "Link",
    url: "https://moodle.elms.hokudai.ac.jp/course/section.php?id=434",
    hasAttachments: false,
  },
  {
    id: "static-gakuseki-hp",
    title: "各種証明書・学籍手続き（北海道大学）",
    category: "学籍・卒業・進級・学位",
    categoryId: "01J6XCVKCHF2D2Q52WJBS0QXBJ",
    folderPath: "",
    guideType: "Link",
    url: "https://www.hokudai.ac.jp/gakusei/campus-life/certificates/certificate.html",
    hasAttachments: false,
  },
  // 学生生活：Unire ガイドに未登録 → 公式サイト
  {
    id: "static-gakusei-hp",
    title: "学生生活（北海道大学）",
    category: "学生生活",
    categoryId: "01J6XCVKCGDN1HEK1GR3C9ECM8",
    folderPath: "",
    guideType: "Link",
    url: "https://www.hokudai.ac.jp/gakusei/",
    hasAttachments: false,
  },
  {
    id: "static-gakusei-shogakukin",
    title: "奨学金・学生寮（北海道大学）",
    category: "学生生活",
    categoryId: "01J6XCVKCGDN1HEK1GR3C9ECM8",
    folderPath: "住まい（学生寮・アパート等）",
    guideType: "Link",
    url: "https://www.hokudai.ac.jp/gakusei/campus-life/certificates/tuition.html",
    hasAttachments: false,
  },
  // 留学生向け情報：ほぼ未登録 → 公式サイト
  {
    id: "static-ryugakusei-hp",
    title: "International Student Support（北海道大学）",
    category: "留学生向け情報",
    categoryId: "01J6XCVKCH6161MJCRCTQM612Q",
    folderPath: "",
    guideType: "Link",
    url: "https://www.hokudai.ac.jp/en/students/student-support/",
    hasAttachments: false,
  },
  // 資格関係：学芸員課程 → ELMS Moodle + 公式サイト
  {
    id: "static-curator-moodle",
    title: "学芸員課程（ELMS Moodle）",
    category: "資格関係",
    categoryId: "",
    folderPath: "学芸員",
    guideType: "Link",
    url: "https://moodle.elms.hokudai.ac.jp/course/index.php?categoryid=9",
    hasAttachments: false,
  },
  {
    id: "static-curator-hp",
    title: "学芸員課程について（北海道大学）",
    category: "資格関係",
    categoryId: "",
    folderPath: "学芸員",
    guideType: "Link",
    url: "https://www.hokudai.ac.jp/gakusei/campus-life/certificates/curator.html",
    hasAttachments: false,
  },
];

// In-memoryキャッシュ（サーバー再起動まで保持）
let cache: { guides: FlatGuide[]; ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10分

interface RawCategory {
  id: string;
  name?: string;
  englishName?: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ guides: cache.guides, cached: true });
  }

  try {
    const categories = await unireFetch(
      "/Categories?userType=Student"
    ) as RawCategory[];

    const allGuides: FlatGuide[] = [];

    await Promise.all(
      categories.map(async (cat) => {
        try {
          const data = await unireFetch(
            `/ContentFolders/contentFolderFamilies/${cat.id}?studentModeAssociationId=`
          );
          const folders: RawFolder[] = Array.isArray(data) ? data : [data as RawFolder];
          const catName = cat.name ?? cat.englishName ?? "";

          await Promise.all(
            folders.map(async (folder) => {
              // contentFolderFamilies のアイテムはフォルダ名が parentContentFolder に入る
              const folderName =
                folder.name ?? folder.parentContentFolder?.name ?? "";
              const guides = await extractGuidesFromFolder(
                folder, catName, cat.id, folderName
              );
              allGuides.push(...guides);
            })
          );
        } catch {
          // カテゴリ取得失敗はスキップ
        }
      })
    );

    // Unire に存在しないカテゴリ・フォルダの補完リンクを追加
    const merged = [...allGuides, ...STATIC_LINKS];

    cache = { guides: merged, ts: Date.now() };
    return NextResponse.json({ guides: merged, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Guide fetch failed" },
      { status: 500 }
    );
  }
}
