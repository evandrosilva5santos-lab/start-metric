import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const exportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)"),
  adAccountId: z.string().optional(),
  clientId: z.string().optional(),
  campaignStatus: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const validationResult = exportQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos", details: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const params = validationResult.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "ORG_NOT_FOUND" }, { status: 404 });
    }

    const orgId = profile.org_id;

    // Buscar campanhas com métricas
    let query = supabase
      .from("campaigns")
      .select(`
        id,
        name,
        status,
        objective,
        ad_account_id,
        client_id,
        account:ad_accounts!inner(name),
        client:clients!inner(name),
        metrics:daily_metrics!inner(spend, revenue_attributed, conversions, impressions, clicks, date)
      `)
      .eq("org_id", orgId)
      .gte("metrics.date", params.from)
      .lte("metrics.date", params.to);

    if (params.adAccountId) {
      query = query.eq("ad_account_id", params.adAccountId);
    }

    if (params.clientId) {
      query = query.eq("client_id", params.clientId);
    }

    if (params.campaignStatus && params.campaignStatus !== "all") {
      query = query.eq("status", params.campaignStatus.toUpperCase());
    }

    const { data: rawData, error } = await query;

    if (error) {
      console.error("Export error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Agrupar por campanha (uma campanha pode ter múltiplas métricas diárias)
    const campaignMap = new Map<string, any>();

    for (const row of rawData || []) {
      const campaignId = row.id;
      if (!campaignMap.has(campaignId)) {
        campaignMap.set(campaignId, {
          campaignName: row.name,
          accountName: row.account?.name || "—",
          clientName: row.client?.name || "—",
          status: row.status || "—",
          objective: row.objective || "—",
          spend: 0,
          revenue: 0,
          conversions: 0,
          impressions: 0,
          clicks: 0,
        });
      }

      const campaign = campaignMap.get(campaignId);
      const metrics = row.metrics || {};

      campaign.spend += Number(metrics.spend) || 0;
      campaign.revenue += Number(metrics.revenue_attributed) || 0;
      campaign.conversions += Number(metrics.conversions) || 0;
      campaign.impressions += Number(metrics.impressions) || 0;
      campaign.clicks += Number(metrics.clicks) || 0;
    }

    // Calcular métricas derivadas
    const campaigns = Array.from(campaignMap.values()).map((c) => {
      const roas = c.spend > 0 ? c.revenue / c.spend : 0;
      const cpa = c.conversions > 0 ? c.spend / c.conversions : 0;
      const cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
      const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
      const grossProfit = c.revenue - c.spend;
      const roi = c.spend > 0 ? (grossProfit / c.spend) * 100 : 0;

      return {
        ...c,
        roas: roas.toFixed(2),
        cpa: cpa.toFixed(2),
        cpm: cpm.toFixed(2),
        ctr: ctr.toFixed(2),
        cpc: cpc.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        roi: roi.toFixed(0),
      };
    });

    // Gerar CSV
    const headers = [
      "Campanha",
      "Conta",
      "Cliente",
      "Status",
      "Objetivo",
      "Investimento",
      "Receita",
      "ROAS",
      "CPA",
      "Lucro",
      "ROI",
      "CPM",
      "CTR",
      "CPC",
      "Impressões",
      "Cliques",
      "Conversões",
    ];

    const rows = campaigns.map((c) => [
      `"${c.campaignName}"`,
      `"${c.accountName}"`,
      `"${c.clientName}"`,
      `"${c.status}"`,
      `"${c.objective}"`,
      c.spend.toFixed(2),
      c.revenue.toFixed(2),
      c.roas,
      c.cpa,
      c.grossProfit,
      `${c.roi}%`,
      c.cpm,
      `${c.ctr}%`,
      c.cpc,
      c.impressions.toLocaleString("pt-BR"),
      c.clicks.toLocaleString("pt-BR"),
      c.conversions.toLocaleString("pt-BR"),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    // Retornar arquivo CSV
    const filename = `start-metric-${params.from}-to-${params.to}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Export CSV error:", error);
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
