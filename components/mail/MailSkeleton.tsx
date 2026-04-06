export function MailSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 min-w-0">
        {/* Sender + date row */}
        <div className="flex items-center justify-between gap-2">
          <div className="h-3.5 bg-gray-200 rounded animate-pulse w-28" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-10 shrink-0" />
        </div>
        {/* Subject */}
        <div className="h-3.5 bg-gray-200 rounded animate-pulse w-4/5" />
        {/* Snippet */}
        <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
      </div>
    </div>
  );
}

export function MailSkeletonList({ count = 8 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <MailSkeleton key={i} />
      ))}
    </div>
  );
}
