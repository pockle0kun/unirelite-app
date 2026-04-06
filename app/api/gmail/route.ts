import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
  internalDate: string;
  labelIds: string[];
}

function getHeader(msg: GmailMessage, name: string): string {
  return (
    msg.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Token expired. Please sign in again." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const maxResults = Math.min(
    parseInt(searchParams.get("maxResults") ?? "20", 10),
    50
  );
  const pageToken = searchParams.get("pageToken") ?? undefined;

  // メッセージ一覧を取得
  const listUrl = new URL(
    "https://www.googleapis.com/gmail/v1/users/me/messages"
  );
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", String(maxResults));
  if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    next: { revalidate: 60 }, // 60秒キャッシュ
  });

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Gmail API error", detail: err },
      { status: listRes.status }
    );
  }

  const listData = await listRes.json();

  if (!listData.messages?.length) {
    return NextResponse.json({ messages: [], nextPageToken: null });
  }

  // 各メッセージの詳細を並列取得（From, Subject, Date のみ）
  const messages = await Promise.all(
    (listData.messages as Array<{ id: string }>).map(async ({ id }) => {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          next: { revalidate: 60 },
        }
      );
      return msgRes.json() as Promise<GmailMessage>;
    })
  );

  // クライアントに返す整形済みデータ
  const formatted = messages.map((msg) => ({
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(msg, "from"),
    subject: getHeader(msg, "subject"),
    date: getHeader(msg, "date"),
    snippet: msg.snippet,
    internalDate: msg.internalDate,
    isUnread: msg.labelIds?.includes("UNREAD") ?? false,
  }));

  return NextResponse.json({
    messages: formatted,
    nextPageToken: listData.nextPageToken ?? null,
  });
}
