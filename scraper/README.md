# Unire スクレイパー

SAMLログインを自動化してUnireのお知らせを全件取得し、`informations.json` に出力します。

## セットアップ

```bash
cd scraper

# 依存パッケージのインストール
pip install -r requirements.txt

# Playwright用ブラウザのインストール（初回のみ）
playwright install chromium
```

## 実行

### 通常実行（お知らせ + ガイド両方）
```bash
python main.py
```

### お知らせのみ（ガイドをスキップ、高速）
```bash
python main.py --no-guides
```

### 強制再ログイン
```bash
python main.py --login
```

## 動作の流れ

1. `cookies.json` が存在して12時間以内なら再利用
2. なければブラウザ（非ヘッドレス）が起動し、SAMLログイン画面が表示される
3. 手動でログイン完了後、自動でCookieを取得・保存
4. `Distributions API` と `ElmsInformations API` を全件取得 → `informations.json`
5. `Categories` → `ContentFolders` → `Guides/view` を再帰的に取得 → `guides.json`

## 出力フォーマット（informations.json）

```json
{
  "fetched_at": "2026-04-06T00:00:00+00:00",
  "total": 120,
  "items": [
    {
      "source": "distributions",
      "id": "...",
      "category": "Careers",
      "title": "タイトル",
      "body": "本文",
      "startAt": "2026-04-01T00:00:00Z",
      "groupName": "全ての学生",
      "isRead": false
    }
  ]
}
```

## 注意事項

- `cookies.json` にはセッション情報が含まれます。Gitにコミットしないでください。
- Cookieの有効期限はUnire側のセッション設定に依存します（通常数時間〜1日）。
- 401エラーが出た場合は `python main.py --login` で再ログインしてください。
