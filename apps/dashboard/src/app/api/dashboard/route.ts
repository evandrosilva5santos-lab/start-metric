import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardData } from "@/lib/dashboard/queries";
import { parseSearchParams } from "@/lib/validation";

export const dynamic = "force-dynamic";

const dashboardQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)")
    .optional(),
  adAccountId: z.string().max(64).optional(),
  campaignStatus: z.enum(["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "all"]).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = parseSearchParams(dashboardQuerySchema, request.nextUrl.searchParams);
  if ("error" in parsed) return parsed.error;

  try {
    const data = await getDashboardData(parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
