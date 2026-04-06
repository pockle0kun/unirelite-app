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

function cookieHeader(jar: CookieJar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function step(
  url: string,
  options: RequestInit,
  jar: CookieJar
): Promise<{ status: number; location: string | null; body: string; jar: CookieJar; url: string }> {
  const res = await fetch(url, {
    ...options,
    redirect: "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      Accept: "text/html,*/*",
      ...(options.headers as Record<string, string> ?? {}),
      ...(Object.keys(jar).length ? { Cookie: cookieHeader(jar) } : {}),
    },
  });
  const newCookies = parseSetCookies(res.headers);
  const updatedJar = { ...jar, ...newCookies };
  let body = "";
  try { body = await res.text(); } catch {}
  return {
    status: res.status,
    location: res.headers.get("location"),
    body: body.slice(0, 3000), // truncate
    jar: updatedJar,
    url,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, password } = await request.json();
  const trace: any[] = [];
  let jar: CookieJar = {};

  // Step 1: GET unire saml login
  let r = await step(`${UNIRE_BASE}/api/samlauth/login`, { method: "GET" }, jar);
  jar = r.jar;
  trace.push({ step: 1, desc: "GET unire/api/samlauth/login", status: r.status, location: r.location, cookies: Object.keys(r.jar) });

  // Step 2: Follow redirect to IdP
  let currentUrl = r.location ? new URL(r.location, r.url).toString() : "";
  if (!currentUrl) return NextResponse.json({ trace, error: "No redirect from Unire" });

  r = await step(currentUrl, { method: "GET" }, jar);
  jar = r.jar;
  trace.push({ step: 2, desc: "GET IdP SSOService", status: r.status, location: r.location, cookies: Object.keys(r.jar) });

  // Step 3: Follow to login.cgi
  if (r.status >= 300 && r.location) {
    currentUrl = new URL(r.location, currentUrl).toString();
    r = await step(currentUrl, { method: "GET" }, jar);
    jar = r.jar;
    trace.push({ step: 3, desc: "GET login.cgi", status: r.status, location: r.location, bodySnippet: r.body.slice(0, 500), cookies: Object.keys(r.jar) });
  }

  // Extract form fields
  const sessidMatch = r.body.match(/name=["']sessid["'][^>]*value=["']([^"']+)["']/i) ?? r.body.match(/value=["']([^"']+)["'][^>]*name=["']sessid["']/i);
  const backMatch = r.body.match(/name=["']back["'][^>]*value=["']([^"']+)["']/i) ?? r.body.match(/value=["']([^"']+)["'][^>]*name=["']back["']/i);
  const actionMatch = r.body.match(/<form[^>]+action=["']([^"']+)["']/i);

  const sessid = sessidMatch?.[1] ?? "";
  const back = backMatch?.[1] ?? "";
  const formAction = actionMatch?.[1] ?? "prelogin.cgi";
  const preloginUrl = new URL(formAction, currentUrl).toString();

  trace.push({ step: "form", sessid: sessid ? "found" : "NOT FOUND", back: back ? back.slice(0, 80) : "NOT FOUND", preloginUrl });

  // Step 4: POST credentials
  const formBody = new URLSearchParams({ dummy: "", username, password, op: "login", back, sessid });
  r = await step(preloginUrl, {
    method: "POST",
    body: formBody.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: currentUrl },
  }, jar);
  jar = r.jar;
  trace.push({ step: 4, desc: "POST prelogin.cgi", status: r.status, location: r.location, bodySnippet: r.body.slice(0, 800), cookies: Object.keys(r.jar) });

  // Step 5: Follow redirect
  if (r.status >= 300 && r.location) {
    currentUrl = new URL(r.location, preloginUrl).toString();
    r = await step(currentUrl, { method: "GET" }, jar);
    jar = r.jar;
    trace.push({ step: 5, desc: "Follow post-login redirect", status: r.status, location: r.location, bodySnippet: r.body.slice(0, 1000), cookies: Object.keys(r.jar) });
  }

  // Check for SAMLResponse
  const hasSamlResponse = r.body.includes("SAMLResponse");
  trace.push({ step: "check", hasSamlResponse, finalUrl: currentUrl });

  return NextResponse.json({ trace });
}
