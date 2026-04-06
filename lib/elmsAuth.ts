/**
 * Hokudai SAML2 authentication flow
 * Unire → Hokudai IdP → SAMLResponse → Unire ACS → session cookies
 */

const UNIRE_BASE = "https://unire.hokudai.ac.jp";
const IDP_BASE = "https://aidipigakunin2.oicte.hokudai.ac.jp";

type CookieJar = Record<string, string>;

function parseSetCookies(headers: Headers): CookieJar {
  const jar: CookieJar = {};
  // Node 18+ supports getSetCookie()
  const setCookieList: string[] =
    typeof (headers as any).getSetCookie === "function"
      ? (headers as any).getSetCookie()
      : (headers.get("set-cookie") ?? "").split(/,(?=[^ ])/);

  for (const raw of setCookieList) {
    const [nameVal] = raw.split(";");
    const eqIdx = nameVal.indexOf("=");
    if (eqIdx > 0) {
      jar[nameVal.slice(0, eqIdx).trim()] = nameVal.slice(eqIdx + 1).trim();
    }
  }
  return jar;
}

function mergeCookies(jar: CookieJar, incoming: CookieJar): CookieJar {
  return { ...jar, ...incoming };
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** fetch without auto-redirect, returns headers + body */
async function fetchNoRedirect(
  url: string,
  options: RequestInit,
  jar: CookieJar
): Promise<{ status: number; headers: Headers; body: string; jar: CookieJar }> {
  const res = await fetch(url, {
    ...options,
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Accept: "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "ja,en;q=0.9",
      ...(options.headers as Record<string, string>),
      ...(Object.keys(jar).length ? { Cookie: cookieHeader(jar) } : {}),
    },
  });

  const newCookies = parseSetCookies(res.headers);
  const updatedJar = mergeCookies(jar, newCookies);
  const body = [200, 400, 401, 403].includes(res.status) ? await res.text() : "";

  return { status: res.status, headers: res.headers, body, jar: updatedJar };
}

/** follow a redirect chain, collecting cookies */
async function followRedirects(
  startUrl: string,
  jar: CookieJar,
  maxRedirects = 8
): Promise<{ url: string; body: string; jar: CookieJar }> {
  let url = startUrl;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    const r = await fetchNoRedirect(url, { method: "GET" }, jar);
    jar = r.jar;

    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) throw new Error("Redirect with no Location header");
      url = new URL(loc, url).toString();
      redirectCount++;
    } else {
      return { url, body: r.body, jar };
    }
  }
  throw new Error("Too many redirects");
}

/** decode HTML entities in attribute values */
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

/** extract a named input value from HTML */
function extractInput(html: string, name: string): string {
  const re = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*?)["']`, "i");
  const re2 = new RegExp(`value=["']([^"']*?)["'][^>]*name=["']${name}["']`, "i");
  const raw = (html.match(re) ?? html.match(re2))?.[1] ?? "";
  return decodeHtml(raw);
}

/** extract form action from HTML */
function extractAction(html: string, base: string): string {
  const m = html.match(/<form[^>]+action=["']([^"']+)["']/i);
  return m ? new URL(m[1], base).toString() : "";
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type ElmsAuthResult =
  | { status: "ok"; saml2Cookie: string; wapid: string }
  | { status: "otp_required"; sessionData: OtpSessionData }
  | { status: "error"; message: string };

export interface OtpSessionData {
  preloginUrl: string;
  sessid: string;
  back: string;
  jar: CookieJar;
}

/**
 * Hokudai SSO is a two-step form:
 *   Step 1: POST username to prelogin.cgi → redirects to login.cgi (password page)
 *   Step 2: POST username+password to login.cgi → redirects to SAMLResponse
 */
export async function elmsLogin(
  username: string,
  password: string
): Promise<ElmsAuthResult> {
  try {
    let jar: CookieJar = {};

    // ── Step 1: GET Unire → follow redirects → username form (prelogin.cgi) ──
    const step1Page = await followRedirects(`${UNIRE_BASE}/api/samlauth/login`, jar);
    jar = step1Page.jar;

    if (!step1Page.body.includes("prelogin.cgi")) {
      return { status: "error", message: "ログインページが見つかりませんでした" };
    }

    const sessid1 = extractInput(step1Page.body, "sessid");
    const back1   = extractInput(step1Page.body, "back");
    const preloginUrl = new URL("prelogin.cgi", step1Page.url).toString();

    if (!sessid1 || !back1) {
      return { status: "error", message: "Step1フォームのパラメータが取得できませんでした" };
    }

    // ── Step 1 POST: username only → get password page ──
    const step1Post = await fetchNoRedirect(
      preloginUrl,
      {
        method: "POST",
        body: new URLSearchParams({ dummy: "", username, password: "password", op: "login", back: back1, sessid: sessid1 }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: step1Page.url },
      },
      jar
    );
    jar = step1Post.jar;

    if (!(step1Post.status >= 300 && step1Post.status < 400) || !step1Post.headers.get("location")) {
      return { status: "error", message: `Step1 POST: 予期しないレスポンス (${step1Post.status})` };
    }

    // ── Step 2: GET login.cgi (password form) ──
    const loginCgiUrl = new URL(step1Post.headers.get("location")!, preloginUrl).toString();
    const step2Page = await followRedirects(loginCgiUrl, jar);
    jar = step2Page.jar;

    const sessid2    = extractInput(step2Page.body, "sessid");
    const back2      = extractInput(step2Page.body, "back");
    const loginCgiAction = (() => {
      const m = step2Page.body.match(/<form[^>]+action=["']([^"']+)["']/i);
      return m ? new URL(m[1], step2Page.url).toString() : new URL("login.cgi", step2Page.url).toString();
    })();

    if (!sessid2 || !back2) {
      return { status: "error", message: "Step2フォームのパラメータが取得できませんでした" };
    }

    // OTP page?
    if (step2Page.url.includes("otplogin") || step2Page.url.includes("motplogin") || step2Page.body.includes("ワンタイムパスワード")) {
      return {
        status: "otp_required",
        sessionData: { preloginUrl: loginCgiAction, sessid: sessid2, back: back2, jar },
      };
    }

    // ── Step 2 POST: username + password to login.cgi ──
    const step2Post = await fetchNoRedirect(
      loginCgiAction,
      {
        method: "POST",
        body: new URLSearchParams({ dummy: "", username, password, op: "login", back: back2, sessid: sessid2 }).toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: step2Page.url },
      },
      jar
    );
    jar = step2Post.jar;

    // Wrong password → redirected back to login.cgi
    if (step2Post.status >= 300 && step2Post.headers.get("location")?.includes("login.cgi")) {
      return { status: "error", message: "IDまたはパスワードが正しくありません" };
    }

    // OTP required at step 2
    if (step2Post.status >= 300 && step2Post.headers.get("location")?.match(/otp/i)) {
      const otpUrl = new URL(step2Post.headers.get("location")!, loginCgiAction).toString();
      const otpPage = await followRedirects(otpUrl, jar);
      jar = otpPage.jar;
      return {
        status: "otp_required",
        sessionData: {
          preloginUrl: loginCgiAction,
          sessid: extractInput(otpPage.body, "sessid") || sessid2,
          back: extractInput(otpPage.body, "back") || back2,
          jar,
        },
      };
    }

    // Success → follow redirects to SAMLResponse
    if (step2Post.status >= 300 && step2Post.headers.get("location")) {
      const nextUrl = new URL(step2Post.headers.get("location")!, loginCgiAction).toString();
      return await completeSamlFlow(nextUrl, jar);
    }

    return { status: "error", message: `Step2 POST: 予期しないレスポンス (${step2Post.status})` };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "不明なエラー" };
  }
}

/**
 * Step 2 (optional): submit OTP.
 */
export async function elmsSubmitOtp(
  otp: string,
  sessionData: OtpSessionData
): Promise<ElmsAuthResult> {
  try {
    const { preloginUrl, sessid, back, jar: jarIn } = sessionData;
    let jar = jarIn;

    const body = new URLSearchParams({
      dummy: "",
      username: "",
      password: otp,
      op: "login",
      back,
      sessid,
    });

    const postRes = await fetchNoRedirect(
      preloginUrl,
      { method: "POST", body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      jar
    );
    jar = postRes.jar;

    if (postRes.status >= 300 && postRes.status < 400) {
      const loc = postRes.headers.get("location")!;
      return await completeSamlFlow(new URL(loc, preloginUrl).toString(), jar);
    }

    return { status: "error", message: "OTP認証に失敗しました" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "不明なエラー" };
  }
}

/** After IdP auth: follow SAMLResponse → Unire ACS → extract cookies */
async function completeSamlFlow(
  startUrl: string,
  jar: CookieJar
): Promise<ElmsAuthResult> {
  // Follow redirects to get the SAMLResponse HTML page
  const samlPage = await followRedirects(startUrl, jar);
  jar = samlPage.jar;

  // Check if already at Unire (cookies may already be set)
  let saml2Cookie = jar[".AspNetCore.saml2"];
  let wapid = jar["WAPID"];
  if (saml2Cookie && wapid) return { status: "ok", saml2Cookie, wapid };

  // The IdP returns an HTML page with a form containing SAMLResponse
  const samlResponse = extractInput(samlPage.body, "SAMLResponse");
  const relayState = extractInput(samlPage.body, "RelayState");
  const acsUrl = extractAction(samlPage.body, samlPage.url);

  if (!samlResponse) {
    return {
      status: "error",
      message: "SAML認証レスポンスが取得できませんでした。IDとパスワードを確認してください。",
    };
  }

  if (!acsUrl) {
    return { status: "error", message: "ACSエンドポイントが見つかりませんでした" };
  }

  // POST SAMLResponse to Unire's ACS endpoint
  const acsBody = new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState });
  const acsPost = await fetchNoRedirect(
    acsUrl,
    {
      method: "POST",
      body: acsBody.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: samlPage.url,
      },
    },
    jar
  );
  jar = acsPost.jar;

  // Follow the final redirect(s) to Unire home, collecting cookies
  if (acsPost.status >= 300 && acsPost.status < 400) {
    const loc = acsPost.headers.get("location")!;
    const unireHome = await followRedirects(new URL(loc, acsUrl).toString(), jar);
    jar = unireHome.jar;
  }

  saml2Cookie = jar[".AspNetCore.saml2"];
  wapid = jar["WAPID"];

  if (saml2Cookie && wapid) {
    return { status: "ok", saml2Cookie, wapid };
  }

  // WAPID may be set on the first actual page load — try fetching Unire home
  if (saml2Cookie && !wapid) {
    const homeRes = await fetchNoRedirect(`${UNIRE_BASE}/`, { method: "GET" }, jar);
    jar = homeRes.jar;
    wapid = jar["WAPID"];
    if (saml2Cookie && wapid) return { status: "ok", saml2Cookie, wapid };
  }

  return {
    status: "error",
    message: `セッションCookieが取得できませんでした (.AspNetCore.saml2: ${saml2Cookie ? "取得済" : "なし"}, WAPID: ${wapid ? "取得済" : "なし"})`,
  };
}
