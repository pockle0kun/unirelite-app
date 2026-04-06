export type TabType = "gmail" | "unire" | "guide" | "dashboard" | "custom" | "unread" | "favorites";

export interface Tab {
  id: string;
  label: string;
  type: TabType;
  query?: string;
  unireType?: string;
}

export const DEFAULT_TABS: Tab[] = [
  {
    id: "favorites",
    label: "お気に入り",
    type: "favorites",
  },
  {
    id: "non-hokudai",
    label: "一般",
    type: "gmail",
    query: "-from:@hokudai.ac.jp -from:@elms.hokudai.ac.jp",
  },
  {
    id: "hokudai",
    label: "北大",
    type: "gmail",
    query: "from:(@hokudai.ac.jp OR @elms.hokudai.ac.jp)",
  },
  {
    id: "unread",
    label: "未読",
    type: "unread",
  },
  {
    id: "unire-elms",
    label: "ELMS",
    type: "unire",
    unireType: "elms",
  },
  {
    id: "guide",
    label: "ガイド",
    type: "guide",
  },
];
