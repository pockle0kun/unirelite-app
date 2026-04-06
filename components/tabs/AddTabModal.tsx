"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (label: string, query: string) => Promise<void>;
}

const EXAMPLES = [
  { label: "GitHub", query: "from:notifications@github.com" },
  { label: "重要", query: "is:important" },
  { label: "添付", query: "has:attachment" },
];

export function AddTabModal({ isOpen, onClose, onAdd }: Props) {
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setQuery("");
    setErr(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !query.trim()) {
      setErr("タブ名とクエリを入力してください");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onAdd(label.trim(), query.trim());
      reset();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* ボトムシート */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* ハンドル */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-4 pb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                カスタムタブを追加
              </h2>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full text-gray-400 active:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-4 pt-1 pb-6 space-y-4">
              {/* タブ名 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  タブ名
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="例: GitHub"
                  maxLength={20}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hokudai-green/30 focus:border-hokudai-green"
                  autoFocus
                />
              </div>

              {/* Gmailクエリ */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Gmail 検索クエリ
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例: from:notifications@github.com"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-hokudai-green/30 focus:border-hokudai-green font-mono"
                />

                {/* クイック例 */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => {
                        setLabel((v) => (v ? v : ex.label));
                        setQuery(ex.query);
                      }}
                      className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-full active:bg-gray-200"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {err && (
                <p className="text-xs text-red-500">{err}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-hokudai-green text-white text-sm font-medium rounded-xl active:opacity-80 disabled:opacity-50 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                {submitting ? "追加中..." : "タブを追加"}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
