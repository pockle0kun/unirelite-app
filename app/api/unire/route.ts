import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface EndpointConfig {
  path: string;
  extraParams?: Record<string, string>;
}

const UNIRE_ENDPOINTS: Record<string, EndpointConfig> = {
  elms:          { path: "ElmsInformations/detailElmsInformations" },
  distributions: {
    path: "Distributions/homeDistributions",
    extraParams: {
      isForIndividual: "false",
      isImportant: "false",
      includeAttachedInfoContents: "true",
      isNoTagOnly: "true",
    },
  },
  others:        { path: "ElmsInformations/detailElmsInformations" },
  class:         { path: "ClassInformations/detailClassInformations" },
  qualification: { path: "QualificationInformations/detailQualificationInformations" },
  studentstatus: { path: "StudentStatusInformations/detailStudentStatusInformations" },
  studentlife:   { path: "StudentLifeInformations/detailStudentLifeInformations" },
  tuition:       { path: "TuitionInformations/detailTuitionInformations" },
  career:        { path: "CareerInformations/detailCareerInformations" },
  international: { path: "InternationalInformations/detailInternationalInformations" },
  foreigners:    { path: "ForeignersInformations/detailForeignersInformations" },
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "elms";
  const skip = searchParams.get("skip") ?? "0";
  const take = searchParams.get("take") ?? "50";

  const endpoint = UNIRE_ENDPOINTS[type];
  if (!endpoint) {
    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }

  // ユーザーごとのELMS認証情報をSupabaseから取得
  const { data: creds, error: credsError } = await supabase
    .from("user_profiles")
    .select("elms_cookie, elms_wapid")
    .eq("user_id", session.user.email)
    .single();

  if (credsError || !creds?.elms_cookie || !creds?.elms_wapid) {
    return NextResponse.json(
      { error: "ELMS_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const unireUrl = new URL(`https://unire.hokudai.ac.jp/api/${endpoint.path}`);
  unireUrl.searchParams.set("itemSkipCount", skip);
  unireUrl.searchParams.set("itemTakeCount", take);

  if (endpoint.extraParams) {
    for (const [key, value] of Object.entries(endpoint.extraParams)) {
      unireUrl.searchParams.set(key, value);
    }
  }

  const res = await fetch(unireUrl.toString(), {
    headers: {
      Referer: "https://unire.hokudai.ac.jp/",
      Cookie: `.AspNetCore.saml2=${creds.elms_cookie}; WAPID=${creds.elms_wapid}`,
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Unire API error", status: res.status },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
