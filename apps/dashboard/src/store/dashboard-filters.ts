"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const RANGE_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_14d", label: "Últimos 14 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
] as const;

export type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

export const LIVE_OPTIONS = [
  { value: 30, label: "Ao vivo · 30s" },
  { value: 60, label: "Ao vivo · 60s" },
  { value: 0, label: "Manual" },
] as const;

export type LiveInterval = (typeof LIVE_OPTIONS)[number]["value"];

type DashboardFiltersState = {
  accountId: string;
  range: RangeValue;
  liveInterval: LiveInterval;
  hideValues: boolean;
  setAccountId: (accountId: string) => void;
  setRange: (range: RangeValue) => void;
  setLiveInterval: (liveInterval: LiveInterval) => void;
  toggleHideValues: () => void;
};

export const useDashboardFilters = create<DashboardFiltersState>()(
  persist(
    (set) => ({
      accountId: "",
      range: "last_30d",
      liveInterval: 30,
      hideValues: false,
      setAccountId: (accountId) => set({ accountId }),
      setRange: (range) => set({ range }),
      setLiveInterval: (liveInterval) => set({ liveInterval }),
      toggleHideValues: () => set((state) => ({ hideValues: !state.hideValues })),
    }),
    // Lido do navegador só depois da hidratação (DashboardControls), para o
    // HTML do servidor e o primeiro render do cliente serem iguais.
    { name: "sm:dashboard-filters", skipHydration: true },
  ),
);
