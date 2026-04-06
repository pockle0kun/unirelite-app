import type { Label } from "@/hooks/useLabels";

interface Props {
  label: Label;
  small?: boolean;
}

export function LabelBadge({ label, small }: Props) {
  const bg = label.color + "22";
  const border = label.color + "55";
  return (
    <span
      style={{ backgroundColor: bg, color: label.color, borderColor: border }}
      className={`inline-flex items-center rounded-full border font-semibold leading-none ${
        small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
      }`}
    >
      {label.name}
    </span>
  );
}
