"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DataState {
  selectedClientId: string | null;
  selectedOrganizationId: string | null;
  filters: {
    from: string;
    to: string;
    adAccountId: string;
    campaignStatuses: string[];
    campaignObjectives: string[];
  };
  setSelectedClient: (clientId: string | null) => void;
  setSelectedOrganization: (orgId: string | null) => void;
  setFilters: (filters: Partial<DataState['filters']>) => void;
  resetData: () => void;
  getActiveFiltersCount: () => number;
}

const DEFAULT_FILTERS = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
  to: new Date().toISOString().split('T')[0],
  adAccountId: 'all',
  campaignStatuses: [] as string[],
  campaignObjectives: [] as string[],
};

export const useAppStore = create<DataState>()(
  persist(
    (set, get) => ({
      selectedClientId: null,
      selectedOrganizationId: null,
      filters: DEFAULT_FILTERS,
      setSelectedClient: (selectedClientId) => set({ selectedClientId }),
      setSelectedOrganization: (selectedOrganizationId) => set({ selectedOrganizationId }),
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters }
        })),
      resetData: () => set({
        selectedClientId: null,
        selectedOrganizationId: null,
        filters: DEFAULT_FILTERS
      }),
      getActiveFiltersCount: () => {
        const filters = get().filters;
        let count = 0;
        if (filters.adAccountId !== 'all') count++;
        if (filters.campaignStatuses.length > 0) count++;
        if (filters.campaignObjectives.length > 0) count++;
        return count;
      },
    }),
    {
      name: 'antigravity-app-storage',
    }
  )
);
