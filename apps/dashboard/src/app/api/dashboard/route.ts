import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const search = request.nextUrl.searchParams;

  try {
    const data = await getDashboardData({
      from: search.get("from") ?? undefined,
      to: search.get("to") ?? undefined,
      adAccountId: search.get("adAccountId") ?? undefined,
      campaignStatus: search.get("campaignStatus") ?? undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
