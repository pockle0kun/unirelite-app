/** "Name <email@example.com>" → { name, email } */
export function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/['"]/g, ""),
      email: match[2].trim(),
    };
  }
  return { name: from, email: from };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-600",
  "bg-green-600",
  "bg-teal-600",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-rose-500",
];

export function getAvatarColor(str: string): string {
  const hash = str
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function formatMailDate(internalDate: string): string {
  const date = new Date(parseInt(internalDate, 10));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const dayMs = 86_400_000;

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (diffMs < 7 * dayMs) {
    return date.toLocaleDateString("ja-JP", { weekday: "short" });
  }
  return date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}
