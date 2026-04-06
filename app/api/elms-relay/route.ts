import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createHmac } from "crypto";

const CORS_ORIGIN = "https://unire.hokudai.ac.jp";
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15分

function corsHeaders(origin: string | null) {
  const allowed = origin === CORS_ORIGIN || !origin;
  return {
    "Access-Control-Allow-Origin": allowed ? (origin ?? "*") : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function signToken(email: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${email}:${exp}`;
  const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET!)
      .update(payload)
      .digest("hex");
    if (sig !== expected) return null;
    const colonIdx = payload.indexOf(":");
    const email = payload.slice(0, colonIdx);
    const exp = parseInt(payload.slice(colonIdx + 1), 10);
    if (Date.now() > exp) return null;
    return email;
  } catch {
    return null;
  }
}

// OPTIONS: preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// GET: generate one-time token for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = signToken(session.user.email);
  return NextResponse.json({ token });
}

// POST: receive cookies from bookmarklet
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const { token, elms_cookie, elms_wapid } = body;

    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400, headers });
    }

    const email = verifyToken(token);
    if (!email) {
      return NextResponse.json({ error: "invalid or expired token" }, { status: 401, headers });
    }

    if (!elms_cookie || !elms_wapid) {
      return NextResponse.json(
        { error: "Cookieが取得できませんでした。HttpOnly制限の可能性があります。" },
        { status: 400, headers }
      );
    }

    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        { user_id: email, elms_cookie, elms_wapid, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers });
    }

    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers });
  }
}
