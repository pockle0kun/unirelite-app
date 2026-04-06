import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface MimePart {
  mimeType: string;
  body: { data?: string; size: number };
  parts?: MimePart[];
}

function decodeBase64url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(part: MimePart, mimeType: string): string {
  if (part.mimeType === mimeType && part.body.data) {
    return decodeBase64url(part.body.data);
  }
  if (part.parts) {
    for (const p of part.parts) {
      const result = extractBody(p, mimeType);
      if (result) return result;
    }
  }
  return "";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}?format=full`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Gmail API error" }, { status: res.status });
  }

  const msg = await res.json();

  // HTML → プレーンテキスト の順で本文を探す
  let body = extractBody(msg.payload, "text/html");
  let isHtml = true;

  if (!body) {
    body = extractBody(msg.payload, "text/plain");
    isHtml = false;
  }

  // シングルパートの場合
  if (!body && msg.payload.body?.data) {
    body = decodeBase64url(msg.payload.body.data);
    isHtml = msg.payload.mimeType === "text/html";
  }

  return NextResponse.json({ body, isHtml });
}
