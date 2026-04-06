"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Wifi, WifiOff, Trash2 } from "lucide-react";

interface Props {
  onConnected?: () => void;
}

export function ElmsSetup({ onConnected }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [samlCookie, setSamlCookie] = useState("");
  const [wapid, setWapid] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"status" | "form">("status");

  useEffect(() => {
    fetch("/api/elms-credentials")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  const handleSave = async () => {
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
      setStep("status");
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
    setStep("status");
  };

  if (connected === null) {
    return <div className="py-8 text-center text-sm text-gray-400">確認中…</div>;
  }

  if (step === "status") {
    return (
      <div className="p-4 space-y-4">
        {/* 接続状態 */}
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
              {connected ? "UnireのELMS情報が表示されます" : "設定するとELMSのお知らせが表示されます"}
            </p>
          </div>
        </div>

        {connected ? (
          <div className="space-y-2">
            <button
              onClick={() => setStep("form")}
              className="w-full py-2.5 rounded-xl bg-hokudai-green text-white text-sm font-medium active:opacity-80"
            >
              Cookieを更新する
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-red-500 text-sm font-medium flex items-center justify-center gap-2 active:opacity-80"
            >
              <Trash2 className="w-4 h-4" />
              接続を解除する
            </button>
          </div>
        ) : (
          <button
            onClick={() => setStep("form")}
            className="w-full py-2.5 rounded-xl bg-hokudai-green text-white text-sm font-medium active:opacity-80"
          >
            ELMSを接続する
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 手順 */}
      <div className="bg-blue-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-700">Cookieの取得方法</p>
        <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
          <li>PCブラウザで <span className="font-mono bg-blue-100 px-1 rounded">unire.hokudai.ac.jp</span> にログイン</li>
          <li>DevTools を開く（F12 または 右クリック→検証）</li>
          <li>「Application」タブ → 「Cookies」→ サイトを選択</li>
          <li><span className="font-mono bg-blue-100 px-1 rounded">.AspNetCore.saml2</span> の値をコピー</li>
          <li><span className="font-mono bg-blue-100 px-1 rounded">WAPID</span> の値をコピー</li>
        </ol>
      </div>

      {/* 入力フォーム */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            .AspNetCore.saml2
          </label>
          <textarea
            value={samlCookie}
            onChange={(e) => setSamlCookie(e.target.value)}
            placeholder="CfDJ8Ad0..."
            rows={3}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-hokudai-green/40 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            WAPID
          </label>
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
          onClick={() => { setStep("status"); setError(null); }}
          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium active:opacity-80"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-hokudai-green text-white text-sm font-medium flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          保存する
        </button>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Cookieはサーバーに暗号化して保存されます。セッション期限が切れたら再設定が必要です。
      </p>
    </div>
  );
}
