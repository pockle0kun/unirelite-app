"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle, AlertCircle, Wifi, WifiOff, Trash2,
  Eye, EyeOff, Loader2, Lock, ShieldCheck, Monitor, Copy, Check,
} from "lucide-react";
import type { OtpSessionData } from "@/lib/elmsAuth";

interface Props {
  onConnected?: () => void;
}

type Step = "status" | "login" | "otp" | "pc_connect";

export function ElmsSetup({ onConnected }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("status");

  // Login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP
  const [otp, setOtp] = useState("");
  const [otpSession, setOtpSession] = useState<OtpSessionData | null>(null);

  // PC connect
  const [pcToken, setPcToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/elms-credentials")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  // Poll for connection when on pc_connect step
  useEffect(() => {
    if (step !== "pc_connect") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      fetch("/api/elms-credentials")
        .then((r) => r.json())
        .then((d) => {
          if (d.connected) {
            setConnected(true);
            setStep("status");
            onConnected?.();
          }
        })
        .catch(() => {});
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, onConnected]);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("IDとパスワードを入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/elms-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username: username.trim(), password }),
      });
      const data = await res.json();

      if (data.status === "ok") {
        setConnected(true);
        setStep("status");
        setUsername("");
        setPassword("");
        onConnected?.();
        return;
      }
      if (data.status === "otp_required") {
        setOtpSession(data.sessionData);
        setStep("otp");
        return;
      }
      setError(data.message ?? "認証に失敗しました");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async () => {
    if (!otp.trim()) { setError("ワンタイムパスワードを入力してください"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/elms-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "otp", otp: otp.trim(), sessionData: otpSession }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        setConnected(true);
        setStep("status");
        setOtp("");
        onConnected?.();
      } else {
        setError(data.message ?? "OTP認証に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("ELMS接続を解除しますか？")) return;
    await fetch("/api/elms-credentials", { method: "DELETE" });
    setConnected(false);
  };

  const handleStartPcConnect = async () => {
    setTokenLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/elms-relay");
      const data = await res.json();
      if (data.token) {
        setPcToken(data.token);
        setStep("pc_connect");
      } else {
        setError("トークンの取得に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (connected === null) {
    return <div className="py-8 text-center text-sm text-gray-400">確認中…</div>;
  }

  // ── ステータス画面 ─────────────────────────────
  if (step === "status") {
    return (
      <div className="p-4 space-y-4 pb-6">
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
              {connected ? "ELMSのお知らせが表示されます" : "接続するとELMSのお知らせが表示されます"}
            </p>
          </div>
        </div>

        {/* 接続ボタン群 */}
        <div className="space-y-2">
          <button
            onClick={() => { setStep("login"); setError(null); }}
            className="w-full py-3 rounded-xl bg-hokudai-green text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80"
          >
            <Wifi className="w-4 h-4" />
            {connected ? "Cookieを再取得する（自動）" : "ELMSに接続する（自動）"}
          </button>

          <button
            onClick={handleStartPcConnect}
            disabled={tokenLoading}
            className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
          >
            {tokenLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Monitor className="w-4 h-4" />
            }
            PCのブラウザで接続する
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-500 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

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

  // ── PC接続画面 ────────────────────────────────
  if (step === "pc_connect" && pcToken) {
    const command = `python scraper/main.py --connect ${pcToken}`;
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="bg-blue-50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-blue-700">PCで以下のコマンドを実行してください</p>
          <p className="text-xs text-blue-600">
            ブラウザが開くのでログイン → 自動でCookieが送信されます（有効期限: 15分）
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-[11px] text-gray-400 mb-1.5 font-mono">ターミナルで実行：</p>
          <div className="flex items-start gap-2">
            <code className="text-xs text-green-400 font-mono flex-1 break-all leading-relaxed">
              {command}
            </code>
            <button
              onClick={() => handleCopy(command)}
              className="shrink-0 text-gray-400 active:text-white transition-colors"
            >
              {copied
                ? <Check className="w-4 h-4 text-green-400" />
                : <Copy className="w-4 h-4" />
              }
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          接続完了を待機中…（自動で画面が切り替わります）
        </div>

        <button
          onClick={() => { setStep("status"); setError(null); }}
          className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium active:opacity-80"
        >
          キャンセル
        </button>
      </div>
    );
  }

  // ── ログインフォーム ────────────────────────────
  if (step === "login") {
    return (
      <div className="p-4 space-y-4 pb-8">
        {/* セキュリティ説明 */}
        <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
          <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600">
            入力した情報はサーバーに送信されません。認証のためだけに使用され、パスワードは即時破棄されます。
          </p>
        </div>

        {/* 北大ID */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            北大統合認証ID
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例: b_kobayashi"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-hokudai-green/40"
          />
        </div>

        {/* パスワード */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            パスワード
          </label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="パスワードを入力"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-hokudai-green/40"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-gray-600"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-500 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { setStep("status"); setError(null); setPassword(""); }}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium active:opacity-80"
          >
            キャンセル
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-hokudai-green text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />認証中…</>
            ) : (
              <><Lock className="w-4 h-4" />接続する</>
            )}
          </button>
        </div>

        <p className="text-[10px] text-center text-gray-400">
          北大の統合認証システム（IDプロバイダ）に直接ログインします
        </p>
      </div>
    );
  }

  // ── OTP入力画面 ────────────────────────────────
  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="bg-amber-50 rounded-xl p-3 space-y-1">
        <p className="text-xs font-semibold text-amber-700">ワンタイムパスワードが必要です</p>
        <p className="text-xs text-amber-600">
          {otpSession?.hint ?? "北大メール（@eis.hokudai.ac.jp）をご確認ください"}
        </p>
        <p className="text-[10px] text-amber-500">
          届いていない場合：迷惑メールフォルダも確認してください
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          ワンタイムパスワード（OTP）
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleOtp()}
          placeholder="6桁のコードを入力"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-hokudai-green/40"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => { setStep("login"); setError(null); setOtp(""); }}
          className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium active:opacity-80"
        >
          戻る
        </button>
        <button
          onClick={handleOtp}
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-hokudai-green text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />確認中…</>
          ) : (
            <><CheckCircle className="w-4 h-4" />確認する</>
          )}
        </button>
      </div>
    </div>
  );
}
