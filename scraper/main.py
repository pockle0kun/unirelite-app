"""
Unire scraper: SAMLログイン自動化 + お知らせ・ガイド全件取得
"""

import json
import time
import asyncio
import argparse
from datetime import datetime, timezone
from pathlib import Path

import httpx
from playwright.async_api import async_playwright, BrowserContext

# ---- 設定 ----

UNIRE_BASE = "https://unire.hokudai.ac.jp"
COOKIES_FILE = Path(__file__).parent / "cookies.json"
OUTPUT_INFORMATIONS = Path(__file__).parent / "informations.json"
OUTPUT_GUIDES = Path(__file__).parent / "guides.json"
FETCH_SIZE = 50

DISTRIBUTIONS_URL = f"{UNIRE_BASE}/api/Distributions/homeDistributions"
DISTRIBUTIONS_PARAMS = {
    "isForIndividual": "false",
    "isImportant": "false",
    "itemTakeCount": str(FETCH_SIZE),
    "includeAttachedInfoContents": "false",
    "isNoTagOnly": "true",
}
ELMS_URL = f"{UNIRE_BASE}/api/ElmsInformations/detailElmsInformations"
CATEGORIES_URL = f"{UNIRE_BASE}/api/Categories"
FOLDER_FAMILIES_URL = f"{UNIRE_BASE}/api/ContentFolders/contentFolderFamilies"
FOLDER_FAMILY_URL = f"{UNIRE_BASE}/api/ContentFolders/contentFolderFamily"
GUIDE_VIEW_URL = f"{UNIRE_BASE}/api/Guides/view"


# ---- Cookie 管理 ----

def load_cookies() -> list[dict] | None:
    if not COOKIES_FILE.exists():
        return None
    try:
        data = json.loads(COOKIES_FILE.read_text(encoding="utf-8"))
        cookies: list[dict] = data.get("cookies", [])
        saved_at: float = data.get("saved_at", 0)
        if time.time() - saved_at > 12 * 3600:
            print("[Cookie] 12時間以上経過。再ログインします。")
            return None
        return cookies
    except Exception as e:
        print(f"[Cookie] 読み込みエラー: {e}")
        return None


def save_cookies(cookies: list[dict]) -> None:
    data = {"saved_at": time.time(), "cookies": cookies}
    COOKIES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[Cookie] {len(cookies)} 件を保存しました → {COOKIES_FILE}")


def cookies_to_httpx(cookies: list[dict]) -> dict[str, str]:
    return {c["name"]: c["value"] for c in cookies}


# ---- SAMLログイン ----

async def login_with_browser() -> list[dict]:
    print("[Login] ブラウザを起動してSAMLログインを開始します...")
    print("[Login] ブラウザ画面でログインを完了してください。")
    print("[Login] ログイン後、Unireのトップページに戻ったら自動で続行します。")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context: BrowserContext = await browser.new_context()
        page = await context.new_page()

        await page.goto(f"{UNIRE_BASE}/api/samlauth/login")

        print("[Login] ログイン完了を待機中（最大5分）...")
        await page.wait_for_url(f"{UNIRE_BASE}/**", timeout=300_000)
        await asyncio.sleep(2)

        cookies = await context.cookies()
        await browser.close()

    print(f"[Login] ログイン完了。Cookie {len(cookies)} 件取得。")
    return cookies


# ---- お知らせ取得 ----

async def fetch_all_distributions(client: httpx.AsyncClient) -> list[dict]:
    results = []
    skip = 0
    print("[Fetch] Distributions 取得開始...")

    while True:
        params = {**DISTRIBUTIONS_PARAMS, "itemSkipCount": str(skip)}
        res = await client.get(DISTRIBUTIONS_URL, params=params)
        if res.status_code == 401:
            raise PermissionError("Cookie期限切れ（401）")
        res.raise_for_status()

        data = res.json()
        items = data if isinstance(data, list) else data.get("items", data.get("data", []))
        if not items:
            break

        results.extend(items)
        print(f"  skip={skip} → {len(items)} 件（累計 {len(results)} 件）")
        if len(items) < FETCH_SIZE:
            break
        skip += FETCH_SIZE

    print(f"[Fetch] Distributions 合計: {len(results)} 件")
    return results


async def fetch_all_elms(client: httpx.AsyncClient) -> list[dict]:
    results = []
    skip = 0
    print("[Fetch] ElmsInformations 取得開始...")

    while True:
        params = {"itemSkipCount": str(skip), "itemTakeCount": str(FETCH_SIZE)}
        res = await client.get(ELMS_URL, params=params)
        if res.status_code == 401:
            raise PermissionError("Cookie期限切れ（401）")
        res.raise_for_status()

        data = res.json()
        items = data if isinstance(data, list) else data.get("items", data.get("data", []))
        if not items:
            break

        results.extend(items)
        print(f"  skip={skip} → {len(items)} 件（累計 {len(results)} 件）")
        if len(items) < FETCH_SIZE:
            break
        skip += FETCH_SIZE

    print(f"[Fetch] ElmsInformations 合計: {len(results)} 件")
    return results


# ---- ガイド取得 ----

async def fetch_categories(client: httpx.AsyncClient) -> list[dict]:
    res = await client.get(CATEGORIES_URL, params={"userType": "Student"})
    if res.status_code == 401:
        raise PermissionError("Cookie期限切れ（401）")
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else data.get("items", [])


def extract_guides_from_folder(folder: dict) -> list[dict]:
    """フォルダオブジェクトからGuideエントリを抽出"""
    return folder.get("guides", folder.get("contentFolderGuides", []))


def extract_child_folders(folder: dict) -> list[dict]:
    return folder.get("childContentFolders", [])


async def fetch_folder_family(client: httpx.AsyncClient, folder_id: str) -> dict:
    res = await client.get(f"{FOLDER_FAMILY_URL}/{folder_id}")
    res.raise_for_status()
    return res.json()


async def collect_guides_from_folder(
    client: httpx.AsyncClient,
    folder: dict,
    category_name: str,
    folder_path: str,
    depth: int = 0,
) -> list[dict]:
    """フォルダを再帰的に辿ってGuideエントリを収集する"""
    collected: list[dict] = []

    guides = extract_guides_from_folder(folder)
    for g in guides:
        collected.append({
            "raw": g,
            "category": category_name,
            "folderPath": folder_path,
        })

    child_folders = extract_child_folders(folder)
    if child_folders and depth < 5:
        tasks = [
            fetch_folder_family(client, cf["id"])
            for cf in child_folders
            if cf.get("id")
        ]
        child_data = await asyncio.gather(*tasks, return_exceptions=True)
        for cf_meta, cf_data in zip(child_folders, child_data):
            if isinstance(cf_data, Exception):
                print(f"  [Guide] 子フォルダ取得失敗: {cf_meta.get('id')} → {cf_data}")
                continue
            child_path = f"{folder_path} / {cf_meta.get('name', '')}"
            nested = await collect_guides_from_folder(
                client, cf_data, category_name, child_path, depth + 1
            )
            collected.extend(nested)

    return collected


async def fetch_guide_detail(client: httpx.AsyncClient, guide_id: str) -> dict | None:
    try:
        res = await client.get(f"{GUIDE_VIEW_URL}/{guide_id}")
        if res.status_code in (403, 404):
            return None
        res.raise_for_status()
        return res.json()
    except Exception as e:
        print(f"  [Guide] 詳細取得失敗: {guide_id} → {e}")
        return None


async def fetch_all_guides(client: httpx.AsyncClient) -> list[dict]:
    print("[Fetch] Guides 取得開始...")

    categories = await fetch_categories(client)
    print(f"  カテゴリ数: {len(categories)}")

    # Step2: カテゴリごとにフォルダツリーを取得
    all_guide_refs: list[dict] = []
    for cat in categories:
        cat_id = cat.get("id")
        cat_name = cat.get("name") or cat.get("englishName") or cat_id
        if not cat_id:
            continue

        res = await client.get(
            f"{FOLDER_FAMILIES_URL}/{cat_id}",
            params={"studentModeAssociationId": ""},
        )
        if res.status_code in (403, 404):
            continue
        if not res.is_success:
            continue

        data = res.json()
        top_folders = data if isinstance(data, list) else data.get("contentFolders", [data])

        for folder in top_folders:
            folder_name = folder.get("name", "")
            refs = await collect_guides_from_folder(
                client, folder, cat_name, folder_name
            )
            all_guide_refs.extend(refs)

    print(f"  Guide参照数: {len(all_guide_refs)}")

    # Step4: Guide本文を並列取得（10件ずつ）
    results: list[dict] = []
    batch_size = 10
    for i in range(0, len(all_guide_refs), batch_size):
        batch = all_guide_refs[i: i + batch_size]
        tasks = [
            fetch_guide_detail(client, ref["raw"].get("id") or ref["raw"].get("guideId", ""))
            for ref in batch
        ]
        details = await asyncio.gather(*tasks)
        for ref, detail in zip(batch, details):
            if detail is None:
                continue
            results.append(normalize_guide(ref, detail))
        print(f"  {min(i + batch_size, len(all_guide_refs))} / {len(all_guide_refs)} 件処理済み")

    print(f"[Fetch] Guides 合計: {len(results)} 件")
    return results


# ---- フォーマット変換 ----

def normalize_distribution(item: dict) -> dict:
    info = item.get("distributionBasicInfo", item)
    category = item.get("category", {})
    return {
        "source": "distributions",
        "id": info.get("id") or item.get("id"),
        "category": category.get("name") or category.get("englishName") or "",
        "title": info.get("title", ""),
        "body": info.get("bodyNoTag") or info.get("body", ""),
        "startAt": info.get("startAt") or info.get("publishDate") or "",
        "groupName": info.get("groupName", ""),
        "isRead": item.get("isRead", False),
    }


def normalize_elms(item: dict) -> dict:
    info = item.get("elmsInformation", item)
    return {
        "source": "elms",
        "id": info.get("id"),
        "category": "ELMS",
        "title": info.get("title", ""),
        "body": info.get("body", ""),
        "startAt": info.get("startAt") or info.get("publishDate") or "",
        "groupName": info.get("groupName", ""),
        "isRead": item.get("isElmsInformationRead", False),
    }


def normalize_guide(ref: dict, detail: dict) -> dict:
    return {
        "source": "guide",
        "id": detail.get("id"),
        "category": ref["category"],
        "folderPath": ref["folderPath"],
        "title": detail.get("title") or detail.get("englishTitle", ""),
        "body": detail.get("body", ""),
        "guideType": detail.get("guideType", "Page"),
        "url": detail.get("url"),
        "startAt": detail.get("startAt", ""),
        "endAt": detail.get("endAt", ""),
        "attachedInfos": [
            {"fileName": a.get("fileName"), "fileKey": a.get("fileKey")}
            for a in detail.get("attachedInfos", [])
        ],
    }


def sort_by_date(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda x: x.get("startAt") or "", reverse=True)


# ---- メイン ----

async def do_fetch(client: httpx.AsyncClient, skip_guides: bool) -> tuple[list[dict], list[dict]]:
    dist_items = await fetch_all_distributions(client)
    elms_items = await fetch_all_elms(client)
    informations = sort_by_date(
        [normalize_distribution(i) for i in dist_items]
        + [normalize_elms(i) for i in elms_items]
    )

    guides: list[dict] = []
    if not skip_guides:
        guides = await fetch_all_guides(client)

    return informations, guides


async def run(force_login: bool = False, skip_guides: bool = False) -> None:
    cookies = None if force_login else load_cookies()

    if cookies is None:
        cookies = await login_with_browser()
        save_cookies(cookies)

    headers = {"Referer": UNIRE_BASE + "/"}

    async with httpx.AsyncClient(
        cookies=cookies_to_httpx(cookies),
        headers=headers,
        timeout=30,
        follow_redirects=True,
    ) as client:
        try:
            informations, guides = await do_fetch(client, skip_guides)
        except PermissionError:
            print("[Error] Cookieが無効です。再ログインします。")
            COOKIES_FILE.unlink(missing_ok=True)
            cookies = await login_with_browser()
            save_cookies(cookies)
            async with httpx.AsyncClient(
                cookies=cookies_to_httpx(cookies),
                headers=headers,
                timeout=30,
                follow_redirects=True,
            ) as client2:
                informations, guides = await do_fetch(client2, skip_guides)

    now = datetime.now(timezone.utc).isoformat()

    OUTPUT_INFORMATIONS.write_text(
        json.dumps({"fetched_at": now, "total": len(informations), "items": informations},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n✅ お知らせ: {len(informations)} 件 → {OUTPUT_INFORMATIONS}")

    if not skip_guides:
        OUTPUT_GUIDES.write_text(
            json.dumps({"fetched_at": now, "total": len(guides), "items": guides},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"✅ ガイド:   {len(guides)} 件 → {OUTPUT_GUIDES}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unire スクレイパー")
    parser.add_argument("--login", action="store_true", help="強制的に再ログインする")
    parser.add_argument("--no-guides", action="store_true", help="ガイド取得をスキップ（お知らせのみ）")
    args = parser.parse_args()
    asyncio.run(run(force_login=args.login, skip_guides=args.no_guides))
