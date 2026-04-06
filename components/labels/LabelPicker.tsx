"use client";

import { useState } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useLabels } from "@/hooks/useLabels";
import { LabelBadge } from "./LabelBadge";

const PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#22C55E", // green
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
];

interface Props {
  open: boolean;
  onClose: () => void;
  itemKey: string;
}

export function LabelPicker({ open, onClose, itemKey }: Props) {
  const { labels, addLabel, removeLabel, toggleAssignment, isAssigned } =
    useLabels();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addLabel(trimmed, newColor);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="ラベル">
      {/* 既存ラベル一覧 */}
      {labels.length === 0 && !creating && (
        <p className="text-sm text-gray-400 text-center py-4">
          ラベルがまだありません
        </p>
      )}

      <div className="space-y-1 mb-4">
        {labels.map((label) => {
          const assigned = isAssigned(itemKey, label.id);
          return (
            <div
              key={label.id}
              className="flex items-center gap-3 px-1 py-2 rounded-xl active:bg-gray-50"
            >
              {/* チェックボックス */}
              <button
                onClick={() => toggleAssignment(itemKey, label.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors`}
                  style={{
                    borderColor: label.color,
                    backgroundColor: assigned ? label.color : "transparent",
                  }}
                >
                  {assigned && <Check className="w-3 h-3 text-white" />}
                </div>
                <LabelBadge label={label} />
              </button>

              {/* 削除ボタン */}
              <button
                onClick={() => removeLabel(label.id)}
                className="p-1.5 rounded-full text-gray-300 active:text-red-400 active:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 新規ラベル作成 */}
      {creating ? (
        <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="ラベル名（例：重要、NEW）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-hokudai-green"
          />

          {/* カラーパレット */}
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-transform active:scale-90"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? c : "transparent",
                  outline: newColor === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCreating(false)}
              className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl active:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 py-2 text-sm text-white rounded-xl transition-colors disabled:opacity-40"
              style={{ backgroundColor: newColor }}
            >
              作成
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 border border-dashed border-gray-200 rounded-2xl active:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新しいラベルを作成
        </button>
      )}
    </BottomSheet>
  );
}
