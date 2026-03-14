"use client";

import { create } from 'zustand';
import type { DashboardCampaignRow as Campaign } from '@/lib/dashboard/types';
import { useUIStore } from '@/store/ui-store';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Falha ao processar campanhas';
}

const FETCH_LOADING_KEY = 'campaigns:fetch';
const MUTATE_LOADING_KEY = 'campaigns:mutate';
const CAMPAIGN_ERROR_KEY = 'campaigns:error';

interface CampaignState {
    campaigns: Campaign[];
    isLoading: boolean;
    hasInitialFetch: boolean;
    error: string | null;

    // Actions
    fetchCampaigns: (apiCall: () => Promise<Campaign[]>) => Promise<void>;
    mutateCampaign: (apiCall: () => Promise<Campaign>) => Promise<void>;
    clearError: () => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
    campaigns: [],
    isLoading: false,
    hasInitialFetch: false,
    error: null,

    fetchCampaigns: async (apiCall) => {
        const ui = useUIStore.getState();
        ui.startLoading(FETCH_LOADING_KEY);
        ui.clearErrorByKey(CAMPAIGN_ERROR_KEY);
        set({ isLoading: true, error: null });

        try {
            const data = await apiCall();
            set({ campaigns: data, isLoading: false, hasInitialFetch: true });
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            set({ error: message, isLoading: false });
            ui.setErrorByKey(CAMPAIGN_ERROR_KEY, message);
        } finally {
            ui.stopLoading(FETCH_LOADING_KEY);
        }
    },

    mutateCampaign: async (apiCall) => {
        const ui = useUIStore.getState();
        ui.startLoading(MUTATE_LOADING_KEY);
        ui.clearErrorByKey(CAMPAIGN_ERROR_KEY);
        set({ isLoading: true, error: null });

        try {
            const updatedCampaign = await apiCall();
            set((state) => ({
                campaigns: state.campaigns.map((c) =>
                    c.campaignId === updatedCampaign.campaignId ? updatedCampaign : c
                ),
                isLoading: false
            }));
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            set({ error: message, isLoading: false });
            ui.setErrorByKey(CAMPAIGN_ERROR_KEY, message);
        } finally {
            ui.stopLoading(MUTATE_LOADING_KEY);
        }
    },

    clearError: () => {
        useUIStore.getState().clearErrorByKey(CAMPAIGN_ERROR_KEY);
        set({ error: null });
    }
}));
