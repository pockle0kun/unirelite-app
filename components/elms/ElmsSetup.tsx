"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, AlertCircle, Wifi, WifiOff, Trash2,
  Bookmark, ExternalLink, Loader2, ChevronRight,
} from "lucide-react";

interface Props {
  onConnected?: () => void;
}

type Mode = "status" | "auto" | "manual";

// ブックマークレットコード生成（トークン埋め込み）
function makeBookmarklet(token: string, appUrl: string): string {
  const code = `(function(){
var c={};
document.cookie.split(';').forEach(function(x){
  var p=x.trim().indexOf('=');
  if(p>0)c[x.trim().slice(0,p)]=x.trim().slice(p+1);
});
var saml=c['.AspNetCore.saml2'];
var wapid=c['WAPID'];
if(!saml||!wapid){
  alert('Cookieを取得できませんでした。\\nUnireにログインしてから実行してください。\\n\\n取得できない場合はUnireLiteで「手動入力」をお試しください。');
  return;
}
fetch('${appUrl}/api/elms-relay',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({token:'${token}',elms_cookie:saml,elms_wapid:wapid})
}).then(function(r){return r.json();})
.then(function(d){
  if(d.ok)alert('✅ UnireLiteにELMSを接続しました！\\nこのタブを閉じてUnireLiteに戻ってください。');
  else alert('❌ 接続に失敗しました\\n'+( d.error||'不明なエラー'));
}).catch(function(e){alert('❌ 通信エラー: '+e.message);});
})()`;
  return "javascript:" + encodeURIComponent(code);
}

export function ElmsSetup({ onConnected }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("status");
  const [token, setToken] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<number>(0);

  // 手動入力
  const [samlCookie, setSamlCookie] = useState("");
  const [wapid, setWapid] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/elms-credentials")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  // 自動取得モード：トークン生成
  const startAuto = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/elms-relay");
    const data = await res.json();
    if (data.token) {
      setToken(data.token);
      setTokenExpiry(Date.now() + 14 * 60 * 1000); // 14分でUI警告
      setMode("auto");
      setPolling(true);
    }
  }, []);

  // ポーリング：接続完了を検出
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(async () => {
      if (Date.now() > tokenExpiry) {
        setPolling(false);
        setToken(null);
        setError("トークンが期限切れです。もう一度やり直してください。");
        setMode("status");
        return;
      }
      const res = await fetch("/api/elms-credentials");
      const data = await res.json();
      if (data.connected) {
        setPolling(false);
        setConnected(true);
        setMode("status");
        onConnected?.();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [polling, tokenExpiry, onConnected]);

  const handleManualSave = async () => {
    if (!samlCookie.trim() || !wapid.trim()) {
      setError("両方の値を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/elms-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elms_cookie: samlCookie.trim(), elms_wapid: wapid.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConnected(true);
      setMode("status");
      setSamlCookie("");
      setWapid("");
      onConnected?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("ELMS接続を解除しますか？")) return;
    await fetch("/api/elms-credentials", { method: "DELETE" });
    setConnected(false);
  };

  const appUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "https://unirelite-app.vercel.app";

  if (connected === null) {
    return <div className="py-8 text-center text-sm text-gray-400">確認中…</div>;
  }

  // ── ステータス画面 ─────────────────────────────
  if (mode === "status") {
    return (
      <div className="p-4 space-y-4">
        <div className={`flex items-center gap-3 p-3 rounded-xl ${connected ? "bg-green-50" : "bg-gray-50"}`}>
          {connected
            ? <Wifi className="w-5 h-5 text-green-600 shrink-0" />
            : <WifiOff className="w-5 h-5 text-gray-400 shrink-0" />
          }
          <div>
            <p className={`text-sm font-semibold ${connected ? "text-green-700" : "text-gray-600"}`}>
              {connected ? "ELMSに接続済み" : "未接続"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {connected ? "ELMSのお知らせが表示されます" : "接続するとELMSのお知らせが表示されます"}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={startAuto}
          className="w-full py-3 rounded-xl bg-hokudai-green text-white text-sm font-medium flex items-center justify-center gap-2 active:opacity-80"
        >
          <Bookmark className="w-4 h-4" />
          {connected ? "Cookieを更新する" : "ELMSを接続する"}
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>

        {connected && (
          <button
            onClick={handleDisconnect}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-red-500 text-sm font-medium flex items-center justify-center gap-2 active:opacity-80"
          >
            <Trash2 className="w-4 h-4" />
            接続を解除する
          </button>
        )}
      </div>
    );
  }

  // ── 自動取得画面 ──────────────────────────────
  if (mode === "auto" && token) {
    const bookmarkletHref = makeBookmarklet(token, appUrl);
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2 text-hokudai-green">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-semibold">接続待機中…</span>
        </div>

        {/* ステップ1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-hokudai-green text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <p className="text-sm font-medium text-gray-700">Unireを開いてログインする</p>
          </div>
          <a
            href="https://unire.hokudai.ac.jp/api/samlauth/login"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-8 flex items-center gap-2 py-2.5 px-4 rounded-xl bg-gray-100 text-sm text-gray-700 active:bg-gray-200"
          >
            <ExternalLink className="w-4 h-4 text-hokudai-green" />
            Unireを開く（新しいタブ）
          </a>
        </div>

        {/* ステップ2 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-hokudai-green text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <p className="text-sm font-medium text-gray-700">ブックマークを保存する</p>
          </div>
          <div className="ml-8 space-y-2">
            <p className="text-xs text-gray-500">以下のボタンをブラウザのブックマークバーにドラッグ＆ドロップしてください</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href={bookmarkletHref}
              draggable
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-hokudai-green/10 border-2 border-dashed border-hokudai-green text-hokudai-green text-sm font-medium cursor-grab active:cursor-grabbing select-none"
            >
              <Bookmark className="w-4 h-4" />
              UnireLite ELMS接続
            </a>
            <p className="text-[10px] text-gray-400">
              ブックマークバーが表示されていない場合：Ctrl+Shift+B（Mac: ⌘+Shift+B）
            </p>
          </div>
        </div>

        {/* ステップ3 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-hokudai-green text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <p className="text-sm font-medium text-gray-700">Unireのページでブックマークをクリック</p>
          </div>
          <p className="ml-8 text-xs text-gray-500">
            Unireのトップページが表示されたら、保存したブックマークをクリックするだけで自動接続されます
          </p>
        </div>

        <hr className="border-gray-100" />

        <div className="flex items-center justify-between">
          <button
            onClick={() => { setPolling(false); setMode("status"); }}
            className="text-sm text-gray-400 active:text-gray-600"
          >
            キャンセル
          </button>
          <button
            onClick={() => { setMode("manual"); setPolling(false); }}
            className="text-xs text-gray-400 underline active:text-gray-600"
          >
            手動で入力する
          </button>
        </div>
      </div>
    );
  }

  // ── 手動入力画面 ──────────────────────────────
  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="bg-blue-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-700">Cookieの手動取得方法</p>
        <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
          <li>PCブラウザで <span className="font-mono bg-blue-100 px-1 rounded">unire.hokudai.ac.jp</span> にログイン</li>
          <li>DevTools（F12）→「Application」→「Cookies」→ サイトを選択</li>
          <li><span className="font-mono bg-blue-100 px-1 rounded">.AspNetCore.saml2</span> の値をコピー</li>
          <li><span className="font-mono bg-blue-100 px-1 rounded">WAPID</span> の値をコピー</li>
        </ol>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">.AspNetCore.saml2</label>
          <textarea
            value={samlCookie}
            onChange={(e) => setSamlCookie(e.target.value)}
            placeholder="CfDJ8Ad0..."
            rows={3}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-hokudai-green/40 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">WAPID</label>
          <input
            type="text"
            value={wapid}
            onChange={(e) => setWapid(e.target.value)}
            placeholder="r8r0D160..."
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-hokudai-green/40"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => { setMode("status"); setError(null); }}
          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium active:opacity-80"
        >
          キャンセル
        </button>
        <button
          onClick={handleManualSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-hokudai-green text-white text-sm font-medium flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <CheckCircle className="w-4 h-4" />
          }
          保存する
        </button>
      </div>
    </div>
  );
}
