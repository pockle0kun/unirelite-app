import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const maxDuration = 30;

const UNIRE_BASE = "https://unire.hokudai.ac.jp";

type CookieJar = Record<string, string>;

function parseSetCookies(headers: Headers): CookieJar {
  const jar: CookieJar = {};
  const list: string[] =
    typeof (headers as any).getSetCookie === "function"
      ? (headers as any).getSetCookie()
      : [];
  for (const raw of list) {
    const [nameVal] = raw.split(";");
    const eqIdx = nameVal.indexOf("=");
    if (eqIdx > 0) jar[nameVal.slice(0, eqIdx).trim()] = nameVal.slice(eqIdx + 1).trim();
  }
  return jar;
}

function cookieStr(jar: CookieJar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function extractInput(html: string, name: string): string {
  const re = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*?)["']`, "i");
  const re2 = new RegExp(`value=["']([^"']*?)["'][^>]*name=["']${name}["']`, "i");
  return decodeHtml((html.match(re) ?? html.match(re2))?.[1] ?? "");
}

async function doFetch(url: string, options: RequestInit, jar: CookieJar) {
  const res = await fetch(url, {
    ...options,
    redirect: "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      Accept: "text/html,*/*",
      ...(options.headers as Record<string, string> ?? {}),
      ...(Object.keys(jar).length ? { Cookie: cookieStr(jar) } : {}),
    },
  });
  const newCookies = parseSetCookies(res.headers);
  const updatedJar = { ...jar, ...newCookies };
  let body = "";
  try { body = await res.text(); } catch {}
  return { status: res.status, location: res.headers.get("location"), body, jar: updatedJar };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, password } = await request.json();
  const trace: any[] = [];
  let jar: CookieJar = {};
  let currentUrl = `${UNIRE_BASE}/api/samlauth/login`;

  // Step 1
  let r = await doFetch(currentUrl, { method: "GET" }, jar);
  jar = r.jar;
  trace.push({ step: 1, url: currentUrl, status: r.status, location: r.location, newCookies: Object.keys(parseSetCookies({ getSetCookie: () => [] } as any)) });

  // Step 2: follow redirects to login page
  let redirectCount = 0;
  while (r.status >= 300 && r.status < 400 && r.location && redirectCount < 6) {
    currentUrl = new URL(r.location, currentUrl).toString();
    r = await doFetch(currentUrl, { method: "GET" }, jar);
    jar = r.jar;
    redirectCount++;
    trace.push({ step: `2.${redirectCount}`, url: currentUrl.slice(0, 120), status: r.status, location: r.location?.slice(0, 120) });
  }

  const loginPageUrl = currentUrl;
  const sessid = extractInput(r.body, "sessid");
  const back = extractInput(r.body, "back");
  const actionMatch = r.body.match(/<form[^>]+action=["']([^"']+)["']/i);
  const formAction = actionMatch?.[1] ?? "prelogin.cgi";
  const preloginUrl = new URL(formAction, currentUrl).toString();

  trace.push({
    step: "form_parse",
    loginPageUrl: loginPageUrl.slice(0, 120),
    sessid: sessid ? sessid.slice(0, 20) + "..." : "NOT FOUND",
    back: back ? back.slice(0, 100) + "..." : "NOT FOUND",
    preloginUrl,
    bodySnippet: r.body.slice(0, 400),
  });

  if (!sessid || !back) {
    return NextResponse.json({ trace, error: "Cannot parse login form" });
  }

  // Step 3: POST credentials
  const formBody = new URLSearchParams({ dummy: "", username, password, op: "login", back, sessid });
  r = await doFetch(preloginUrl, {
    method: "POST",
    body: formBody.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: loginPageUrl },
  }, jar);
  jar = r.jar;
  trace.push({
    step: 3,
    desc: "POST prelogin.cgi",
    status: r.status,
    location: r.location?.slice(0, 120),
    bodySnippet: r.body.slice(0, 600),
    cookieKeys: Object.keys(jar),
  });

  // Step 4: follow post-login redirect
  if (r.status >= 300 && r.location) {
    currentUrl = new URL(r.location, preloginUrl).toString();

    if (r.location.includes("login.cgi")) {
      trace.push({ step: 4, result: "WRONG_CREDENTIALS — redirected back to login.cgi" });
      return NextResponse.json({ trace });
    }

    r = await doFetch(currentUrl, { method: "GET" }, jar);
    jar = r.jar;

    const isOtpPage = currentUrl.match(/otp/i) || r.body.includes("ワンタイム") || r.body.includes("one-time") || r.body.includes("otp");
    trace.push({
      step: 4,
      desc: "Follow post-login redirect",
      url: currentUrl.slice(0, 120),
      status: r.status,
      location: r.location?.slice(0, 120),
      isOtpPage: !!isOtpPage,
      hasSAMLResponse: r.body.includes("SAMLResponse"),
      bodyFull: isOtpPage ? r.body : r.body.slice(0, 800),
      cookieKeys: Object.keys(jar),
    });
  }

  // Step 5: more redirects if needed
  while (r.status >= 300 && r.location && redirectCount < 10) {
    currentUrl = new URL(r.location, currentUrl).toString();
    r = await doFetch(currentUrl, { method: "GET" }, jar);
    jar = r.jar;
    redirectCount++;
    const isOtpPage = currentUrl.match(/otp/i) || r.body.includes("ワンタイム");
    trace.push({
      step: `5.${redirectCount}`,
      url: currentUrl.slice(0, 120),
      status: r.status,
      isOtpPage: !!isOtpPage,
      hasSAMLResponse: r.body.includes("SAMLResponse"),
      bodyFull: isOtpPage ? r.body : r.body.slice(0, 400),
    });
  }

  // Check SAMLResponse
  const samlResponse = extractInput(r.body, "SAMLResponse");
  const acsAction = r.body.match(/<form[^>]+action=["']([^"']+)["']/i)?.[1] ?? "";
  trace.push({
    step: "saml_check",
    hasSAMLResponse: !!samlResponse,
    samlResponseLength: samlResponse.length,
    acsAction: acsAction.slice(0, 80),
  });

  return NextResponse.json({ trace, finalCookies: Object.keys(jar) });
}

// Allow GET for testing (returns 405 hint)
export async function GET() {
  return NextResponse.json({ message: "Use POST with {username, password}" }, { status: 200 });
}
