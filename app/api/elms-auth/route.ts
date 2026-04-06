import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { elmsLogin, elmsSubmitOtp, type OtpSessionData } from "@/lib/elmsAuth";

// Vercel Hobby: max 10s, Pro: max 60s
export const maxDuration = 30;

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? null;
}

export async function POST(request: NextRequest) {
  const email = await getUserEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // ── Login with username/password ──
  if (action === "login") {
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json({ error: "username and password required" }, { status: 400 });
    }

    const result = await elmsLogin(username, password);

    if (result.status === "ok") {
      await saveCookies(email, result.saml2Cookie, result.wapid);
      return NextResponse.json({ status: "ok" });
    }

    if (result.status === "otp_required") {
      // Return session data to client (stateless — client holds it temporarily)
      return NextResponse.json({ status: "otp_required", sessionData: result.sessionData });
    }

    return NextResponse.json({ status: "error", message: result.message }, { status: 400 });
  }

  // ── Submit OTP ──
  if (action === "otp") {
    const { otp, sessionData } = body as { otp: string; sessionData: OtpSessionData };
    if (!otp || !sessionData) {
      return NextResponse.json({ error: "otp and sessionData required" }, { status: 400 });
    }

    const result = await elmsSubmitOtp(otp, sessionData);

    if (result.status === "ok") {
      await saveCookies(email, result.saml2Cookie, result.wapid);
      return NextResponse.json({ status: "ok" });
    }

    const otpMsg = result.status === "error" ? result.message : "OTP認証に失敗しました";
    return NextResponse.json({ status: "error", message: otpMsg }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function saveCookies(email: string, saml2Cookie: string, wapid: string) {
  await supabase
    .from("user_profiles")
    .upsert(
      { user_id: email, elms_cookie: saml2Cookie, elms_wapid: wapid, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}
