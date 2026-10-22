"use client";

import { useCallback, useEffect, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMetaAccounts } from "@/hooks/useMetaDashboard";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { useOverviewStatus } from "@/store/overview-status";
import { shortDate } from "@/lib/dashboard/overview-range";
import { ALL_ACCOUNTS, DashboardControls, type OverviewPlatform, type ScopeChange } from "@/components/layout/DashboardControls";

const CUSTOM_RANGE = "custom";

type CustomRange = { from: string; to: string } | null;

function parsePlatform(value: string | null): OverviewPlatform {
  return value === "google" || value === "all" ? value : "meta";
}

function overviewHref(change: ScopeChange, custom: CustomRange, platform: OverviewPlatform): string {
  const params = new URLSearchParams();
  if (platform !== "meta") params.set("platform", platform);
  if (change.clientId) params.set("client", change.clientId);
  if (change.accountId && change.accountId !== ALL_ACCOUNTS) params.set("account", change.accountId);
  if (custom && change.range === CUSTOM_RANGE) {
    params.set("from", custom.from);
    params.set("to", custom.to);
  } else {
    params.set("range", change.range);
  }
  return `/?${params.toString()}`;
}

export function OverviewControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const generatedAt = useOverviewStatus((s) => s.generatedAt);
  const liveInterval = useDashboardFilters((s) => s.liveInterval);
  const clientId = useDashboardFilters((s) => s.clientId);
  const accountId = useDashboardFilters((s) => s.accountId);
  const range = useDashboardFilters((s) => s.range);
  const setOperationalScope = useDashboardFilters((s) => s.setOperationalScope);
  const { accounts, clients, isSuccess } = useMetaAccounts();

  const urlClient = searchParams.get("client");
  const urlAccount = searchParams.get("account");
  const urlRange = searchParams.get("range");
  const urlFrom = searchParams.get("from");
  const urlTo = searchParams.get("to");
  const urlPlatform = parsePlatform(searchParams.get("platform"));
  const custom: CustomRange = useMemo(
    () => (!urlRange && urlFrom && urlTo ? { from: urlFrom, to: urlTo } : null),
    [urlFrom, urlRange, urlTo],
  );

  const navigate = useCallback(
    (change: ScopeChange, replace = false, platform: OverviewPlatform = urlPlatform) => {
      const href = overviewHref(change, custom, platform);
      startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
    },
    [custom, router, urlPlatform],
  );

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  useEffect(() => {
    if (isPending || !isSuccess || urlClient || !clients.some((client) => client.id === clientId)) return;
    navigate({ clientId, accountId: accountId || ALL_ACCOUNTS, range: custom ? CUSTOM_RANGE : range }, true);
  }, [accountId, clientId, clients, custom, isPending, isSuccess, navigate, range, urlClient]);

  useEffect(() => {
    if (isPending || !isSuccess || !urlClient || urlClient === clientId) return;
    if (!clients.some((client) => client.id === urlClient)) return;
    const owned = accounts.filter((account) => account.clientId === urlClient && account.isActive);
    const kept = owned.find((account) => account.id === urlAccount) ?? owned[0];
    setOperationalScope({ clientId: urlClient, platform: "meta", accountId: kept?.id ?? "" });
  }, [accounts, clientId, clients, isPending, isSuccess, setOperationalScope, urlAccount, urlClient]);

  useEffect(() => {
    if (liveInterval <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) refresh();
    }, liveInterval * 1000);
    return () => window.clearInterval(timer);
  }, [liveInterval, refresh]);

  const accountValue = urlAccount ?? (urlClient ? ALL_ACCOUNTS : accountId);

  return (
    <DashboardControls
      allAccountsLabel="Todas as contas do cliente"
      accountValue={accountValue}
      rangeValue={urlRange ?? (custom ? CUSTOM_RANGE : range)}
      customRangeLabel={custom ? `${shortDate(custom.from)} → ${shortDate(custom.to)}` : null}
      onScopeChange={(change) => navigate(change)}
      platformValue={urlPlatform}
      clientValue={urlPlatform === "meta" ? undefined : (urlClient ?? clientId)}
      onPlatformChange={(platform) =>
        navigate(
          { clientId: urlClient ?? clientId, accountId: ALL_ACCOUNTS, range: urlRange ?? (custom ? CUSTOM_RANGE : range) },
          false,
          platform,
        )
      }
      status={{
        isFetching: isPending,
        isError: false,
        updatedAt: generatedAt,
        canRefresh: true,
        refresh,
        fetchingTitle: "Lendo os números mais recentes do banco…",
        refreshLabel: "Recarregar números do banco",
      }}
    />
  );
}
