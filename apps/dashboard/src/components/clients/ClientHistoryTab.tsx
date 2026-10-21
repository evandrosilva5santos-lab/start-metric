"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

type Origin = "meta" | "integration" | "platform" | "system" | "manual";

type ActivityItem = {
  id: string;
  startedAt: string;
  title: string;
  detail: string | null;
  count: number;
  objectNames: string[];
  moreObjects: number;
  origin: Origin;
  actorName: string | null;
  appName: string | null;
  countsAsWork: boolean;
};

type ActivityResponse = {
  timezone: string;
  from: string;
  to: string;
  accounts: number;
  items: ActivityItem[];
  totalEvents: number;
  truncated: boolean;
  sync: {
    lastSyncedAt: string | null;
    running: boolean;
    lastError: { code: string | null; at: string } | null;
    daysComplete: number;
    daysTotal: number;
  };
};

type Preset = "7d" | "last_week" | "30d";

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "last_week", label: "Semana passada" },
  { id: "30d", label: "30 dias" },
];

const ORIGIN: Record<Origin, { label: string; className: string }> = {
  meta: { label: "Registrado na Meta", className: "bg-primary-tint text-primary" },
  integration: { label: "Via automação do gestor", className: "bg-primary-tint text-primary" },
  system: { label: "Feito pelo painel", className: "bg-primary-tint text-primary" },
  manual: { label: "Informado pelo gestor", className: "bg-subtle text-text-primary" },
  platform: { label: "Aviso da plataforma", className: "bg-subtle text-text-secondary" },
};

const DEFAULT_TZ = "America/Sao_Paulo";

function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function rangeFor(preset: Preset, timezone: string): { from: string; to: string } {
  const today = todayIn(timezone);
  if (preset === "30d") return { from: shiftDay(today, -29), to: today };
  if (preset === "last_week") {
    const [y, m, d] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const thisMonday = shiftDay(today, -(weekday === 0 ? 6 : weekday - 1));
    return { from: shiftDay(thisMonday, -7), to: shiftDay(thisMonday, -1) };
  }
  return { from: shiftDay(today, -6), to: today };
}

function sinceLabel(iso: string | null): string {
  if (!iso) return "ainda não sincronizado";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "sincronizado agora há pouco";
  if (minutes < 60) return `sincronizado há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `sincronizado há ${hours} h` : `sincronizado há ${Math.round(hours / 24)} dias`;
}

export function ClientHistoryTab({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("7d");
  const [showPlatform, setShowPlatform] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TZ);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const range = useMemo(() => rangeFor(preset, timezone), [preset, timezone]);
  const queryKey = ["client-activity", clientId, range.from, range.to, showPlatform] as const;

  const activity = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<ActivityResponse> => {
      const params = new URLSearchParams({ from: range.from, to: range.to, scope: showPlatform ? "all" : "work" });
      const res = await fetch(`/api/clients/${clientId}/activity?${params}`, { signal });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Não foi possível carregar o histórico.");
      if (body.timezone && body.timezone !== timezone) setTimezone(body.timezone);
      return body as ActivityResponse;
    },
    staleTime: 60_000,
    retry: false,
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/activity/sync`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Não foi possível atualizar agora.");
      return body as { synced: number; skipped: number; inserted: number; status: string; expired: boolean };
    },
    onSuccess: (r) => {
      if (r.expired) setNotice({ tone: "warn", text: "A conexão com a Meta venceu. Reconecte em Integrações → Meta Ads." });
      else if (r.synced === 0) setNotice({ tone: "ok", text: "Já estava atualizado há pouco. Tente de novo em alguns minutos." });
      else if (r.status === "partial") setNotice({ tone: "warn", text: `Atualização parcial: ${r.inserted} alterações novas. O restante continua na próxima sincronização.` });
      else setNotice({ tone: "ok", text: r.inserted > 0 ? `${r.inserted} alterações novas importadas.` : "Histórico em dia." });
      void queryClient.invalidateQueries({ queryKey: ["client-activity", clientId] });
    },
    onError: (err) => setNotice({ tone: "warn", text: err instanceof Error ? err.message : "Erro ao atualizar." }),
  });

  const data = activity.data;
  const days = useMemo(() => {
    const byDay = new Map<string, ActivityItem[]>();
    const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    for (const item of data?.items ?? []) {
      const key = keyFmt.format(new Date(item.startedAt));
      byDay.set(key, [...(byDay.get(key) ?? []), item]);
    }
    return [...byDay.entries()];
  }, [data, timezone]);

  const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" });
  const workItems = (data?.items ?? []).filter((i) => i.countsAsWork).length;

  return (
    <section aria-labelledby="client-history-title" className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="client-history-title" className="font-display text-base font-semibold text-foreground">
            Histórico de atividades
          </h2>
          <p className="text-sm text-text-secondary">Tudo o que foi alterado nas contas deste cliente, com origem e horário.</p>
        </div>
        <Button variant="outline" onClick={() => refresh.mutate()} loading={refresh.isPending} className="h-11 shrink-0">
          <RefreshCw size={16} aria-hidden="true" />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            aria-pressed={preset === p.id}
            className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
              preset === p.id ? "border-primary bg-primary-tint text-primary" : "border-border bg-card text-text-primary hover:bg-subtle"
            }`}
          >
            {p.label}
          </button>
        ))}
        <label className="ml-1 flex h-9 cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={showPlatform} onChange={(e) => setShowPlatform(e.target.checked)} className="h-4 w-4 accent-primary" />
          Mostrar avisos e automações da Meta
        </label>
      </div>

      {data && (
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-foreground tabular-nums">{workItems}</span> itens de trabalho no período · {sinceLabel(data.sync.lastSyncedAt)}
          {data.sync.daysTotal > 0 && data.sync.daysComplete < data.sync.daysTotal && (
            <> · importando histórico ({data.sync.daysComplete} de {data.sync.daysTotal} dias-conta)</>
          )}
        </p>
      )}

      {notice && (
        <p role="status" className={`rounded-lg p-3 text-sm ${notice.tone === "warn" ? "bg-warning-tint text-warning" : "bg-primary-tint text-primary"}`}>
          {notice.text}
        </p>
      )}

      {data?.sync.lastError?.code === "expired" && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-tint p-3 text-sm text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            A conexão com a Meta venceu e o histórico parou de ser importado.{" "}
            <Link href="/settings/meta" className="font-semibold underline">Reconectar</Link>
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {activity.isLoading ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label="Carregando histórico">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-subtle motion-reduce:animate-none" />
            ))}
          </div>
        ) : activity.error ? (
          <p role="alert" className="p-4 text-sm text-warning">{(activity.error as Error).message}</p>
        ) : data && data.accounts === 0 ? (
          <EmptyState text="Este cliente ainda não tem conta de anúncios ligada. Ligue uma conta em “Contas de anúncio” para o histórico começar." />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            text={
              data.sync.lastSyncedAt
                ? "Nenhuma alteração registrada neste período."
                : "O histórico ainda está sendo importado da Meta. Clique em Atualizar ou volte em alguns minutos."
            }
          />
        ) : (
          days.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-2 bg-subtle px-4 py-2 text-[13px]">
                <span className="font-semibold capitalize text-foreground">{dayFmt.format(new Date(`${day}T12:00:00Z`))}</span>
                <span className="text-text-secondary">{items.length} {items.length === 1 ? "item" : "itens"}</span>
              </div>
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:gap-4">
                    <span className="w-11 shrink-0 pt-0.5 text-[13px] font-medium tabular-nums text-text-secondary">
                      {timeFmt.format(new Date(item.startedAt))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                        {item.count > 1 && <span className="font-normal text-text-secondary"> · {item.count} alterações</span>}
                      </p>
                      {item.detail ? (
                        <p className="mt-0.5 break-words text-[13px] text-text-secondary">{item.detail}</p>
                      ) : item.objectNames.length > 0 ? (
                        <p className="mt-0.5 break-words text-[13px] text-text-secondary">
                          {item.objectNames.join("; ")}
                          {item.moreObjects > 0 && ` e mais ${item.moreObjects}`}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-text-secondary sm:hidden">{item.actorName}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORIGIN[item.origin].className}`}>
                        {ORIGIN[item.origin].label}
                      </span>
                      <span className="hidden max-w-[180px] truncate text-xs text-text-secondary sm:block">
                        {item.actorName}
                        {item.origin === "meta" && item.appName ? ` · ${item.appName === "Power Editor" ? "Gerenciador" : item.appName}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {data?.truncated && (
        <p className="text-xs text-text-secondary">Período com muitas alterações: mostrando as 5.000 mais recentes. Escolha um período menor.</p>
      )}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint text-primary">
        <History size={20} aria-hidden="true" />
      </div>
      <p className="max-w-md text-sm text-text-secondary">{text}</p>
    </div>
  );
}
