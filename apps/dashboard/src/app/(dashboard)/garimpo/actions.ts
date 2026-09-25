"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase, getSessionUser } from "@/lib/auth/session";
import { runScan } from "@/lib/garimpo/ingest";
import { runWatchForOrg } from "@/lib/garimpo/watch";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; needsConfirm?: boolean };

async function requireOrg() {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  const orgId = (data?.org_id as string | null) ?? null;
  return orgId ? { supabase, orgId } : null;
}

const scanSchema = z.object({
  niche: z.string().trim().min(2).max(120),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/),
  source: z.enum(["api_oficial", "terceiro", "scraper_proprio"]),
});

export async function startScan(input: z.input<typeof scanSchema>): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx) return { ok: false, error: "Sessão expirada. Entre de novo para varrer." };
  const parsed = scanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informe um nicho (2+ letras) e um país com 2 letras." };

  const summary =
    parsed.data.source === "scraper_proprio"
      ? await runWatchForOrg(ctx.supabase, ctx.orgId)
      : await runScan(ctx.supabase, { orgId: ctx.orgId, ...parsed.data });
  revalidatePath("/garimpo");
  if (!summary) return { ok: false, error: "Nenhuma oferta aprovada para o scraper próprio revisitar." };
  if (summary.status === "ok") {
    return { ok: true, message: `${summary.adsRead} anúncios lidos, ${summary.domainsFound} domínios.` };
  }
  return { ok: false, error: summary.message ?? "A varredura não terminou." };
}

const statusSchema = z.object({
  offerId: z.string().uuid(),
  status: z.enum(["novo", "em_analise", "aprovado", "descartado"]),
  confirmDivergent: z.boolean().optional(),
});

export async function setOfferStatus(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  const { offerId, status, confirmDivergent } = parsed.data;

  const { data: offer } = await ctx.supabase
    .from("garimpo_offers")
    .select("id, domain")
    .eq("id", offerId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!offer) return { ok: false, error: "Oferta não encontrada." };

  if (status === "aprovado" && confirmDivergent !== true) {
    const { count } = await ctx.supabase
      .from("garimpo_offer_domains")
      .select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId)
      .eq("offer_id", offerId)
      .eq("divergent", true);
    if ((count ?? 0) > 0) {
      return { ok: false, needsConfirm: true, error: "O domínio exibido não é o domínio final. Confirme para aprovar." };
    }
  }

  const { error } = await ctx.supabase
    .from("garimpo_offers")
    .update({ status, watch: status === "aprovado", updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/garimpo");
  revalidatePath(`/garimpo/${encodeURIComponent(offer.domain)}`);
  return { ok: true, message: status === "aprovado" ? "Aprovada: o scraper próprio vai revisitar todo dia." : undefined };
}

const cutsSchema = z.object({
  minAds: z.coerce.number().int().min(0).max(10_000),
  minDays: z.coerce.number().int().min(0).max(3650),
  minPages: z.coerce.number().int().min(0).max(1000),
  formats: z.array(z.enum(["image", "video", "carousel", "dco", "dpa"])).max(5),
});

export async function saveCuts(input: z.input<typeof cutsSchema>): Promise<ActionResult> {
  const ctx = await requireOrg();
  if (!ctx) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const parsed = cutsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Valores de corte inválidos." };
  const { error } = await ctx.supabase.from("garimpo_cuts").upsert(
    {
      org_id: ctx.orgId,
      min_ads: parsed.data.minAds,
      min_days: parsed.data.minDays,
      min_pages: parsed.data.minPages,
      formats: parsed.data.formats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (error) return { ok: false, error: "Não foi possível salvar os cortes." };
  revalidatePath("/garimpo");
  return { ok: true };
}
