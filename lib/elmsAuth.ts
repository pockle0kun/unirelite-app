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

/** extract a named input value from HTML */
function extractInput(html: string, name: string): string {
  const re = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*?)["']`, "i");
  const re2 = new RegExp(`value=["']([^"']*?)["'][^>]*name=["']${name}["']`, "i");
  return (html.match(re) ?? html.match(re2))?.[1] ?? "";
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
 * Step 1: submit username + password.
 * Returns either success, otp_required, or error.
 */
export async function elmsLogin(
  username: string,
  password: string
): Promise<ElmsAuthResult> {
  try {
    let jar: CookieJar = {};

    // 1) GET unire/api/samlauth/login → follow redirects → IdP login page
    const loginPage = await followRedirects(
      `${UNIRE_BASE}/api/samlauth/login`,
      jar
    );
    jar = loginPage.jar;
    const html = loginPage.body;

    if (!html.includes("prelogin.cgi")) {
      return { status: "error", message: "ログインページが見つかりませんでした" };
    }

    // 2) Extract hidden fields
    const sessid = extractInput(html, "sessid");
    const back = extractInput(html, "back");
    const preloginUrl = new URL("prelogin.cgi", loginPage.url).toString();

    if (!sessid || !back) {
      return { status: "error", message: "フォームのパラメータが取得できませんでした" };
    }

    // 3) POST credentials
    const body = new URLSearchParams({
      dummy: "",
      username,
      password,
      op: "login",
      back,
      sessid,
    });

    const postRes = await fetchNoRedirect(
      preloginUrl,
      { method: "POST", body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: loginPage.url } },
      jar
    );
    jar = postRes.jar;

    // 4a) OTP required → back to login page with OTP prompt
    if (postRes.status === 200 && postRes.body.includes("otp")) {
      const newSessid = extractInput(postRes.body, "sessid") || sessid;
      const newBack = extractInput(postRes.body, "back") || back;
      return {
        status: "otp_required",
        sessionData: { preloginUrl, sessid: newSessid, back: newBack, jar },
      };
    }

    // 4b) Wrong password
    if (
      postRes.status === 200 &&
      (postRes.body.includes("Invalid") ||
        postRes.body.includes("incorrect") ||
        postRes.body.includes("認証に失敗") ||
        postRes.body.includes("パスワードが違"))
    ) {
      return { status: "error", message: "IDまたはパスワードが正しくありません" };
    }

    // 4c) Redirect → continue SAML flow
    if (postRes.status >= 300 && postRes.status < 400) {
      const loc = postRes.headers.get("location")!;
      const nextUrl = new URL(loc, preloginUrl).toString();
      return await completeSamlFlow(nextUrl, jar);
    }

    return { status: "error", message: `予期しないレスポンス (${postRes.status})` };
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

  // The IdP returns an HTML page with a form containing SAMLResponse
  const samlResponse = extractInput(samlPage.body, "SAMLResponse");
  const relayState = extractInput(samlPage.body, "RelayState");
  const acsUrl = extractAction(samlPage.body, samlPage.url);

  if (!samlResponse || !acsUrl) {
    // Maybe already redirected to Unire — check cookies
    const saml2 = jar[".AspNetCore.saml2"];
    const wapid = jar["WAPID"];
    if (saml2 && wapid) return { status: "ok", saml2Cookie: saml2, wapid };
    return { status: "error", message: "SAML認証レスポンスが取得できませんでした" };
  }

  // POST SAMLResponse to Unire's ACS endpoint
  const acsBody = new URLSearchParams({ SAMLResponse: samlResponse, RelayState: relayState });
  const acsPost = await fetchNoRedirect(
    acsUrl,
    { method: "POST", body: acsBody.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: samlPage.url } },
    jar
  );
  jar = acsPost.jar;

  // Follow the final redirect(s) to Unire home
  if (acsPost.status >= 300 && acsPost.status < 400) {
    const loc = acsPost.headers.get("location")!;
    const unireHome = await followRedirects(new URL(loc, acsUrl).toString(), jar);
    jar = unireHome.jar;
  }

  const saml2Cookie = jar[".AspNetCore.saml2"];
  const wapid = jar["WAPID"];

  if (saml2Cookie && wapid) {
    return { status: "ok", saml2Cookie, wapid };
  }

  return {
    status: "error",
    message: "セッションCookieが取得できませんでした。ログインは成功した可能性がありますが、Cookieの取得に失敗しました。",
  };
}
