"use client";
import { useState } from "react";

export default function ElmsTestPage() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/elms-auth-debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    setResult(await res.json());
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "monospace", padding: 16, maxWidth: 800 }}>
      <h2>ELMS Auth Debug</h2>
      <input placeholder="北大ID" value={u} onChange={e => setU(e.target.value)}
        style={{ display: "block", marginBottom: 8, padding: 8, width: "100%" }} />
      <input placeholder="パスワード" type="password" value={p} onChange={e => setP(e.target.value)}
        style={{ display: "block", marginBottom: 8, padding: 8, width: "100%" }} />
      <button onClick={run} disabled={loading}
        style={{ padding: "8px 16px", marginBottom: 16 }}>
        {loading ? "実行中…" : "実行"}
      </button>
      {result && (
        <pre style={{ background: "#f0f0f0", padding: 12, overflow: "auto", fontSize: 11, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
