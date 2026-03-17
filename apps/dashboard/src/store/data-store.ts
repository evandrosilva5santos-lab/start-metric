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
    campaignStatus: string;
    clientId: string;
  };
  setSelectedClient: (clientId: string | null) => void;
  setSelectedOrganization: (orgId: string | null) => void;
  setFilters: (filters: Partial<DataState['filters']>) => void;
  resetData: () => void;
}

const DEFAULT_FILTERS = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
  to: new Date().toISOString().split('T')[0],
  adAccountId: 'all',
  campaignStatus: 'all',
  clientId: 'all',
};

export const useAppStore = create<DataState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'antigravity-app-storage',
    }
  )
);
