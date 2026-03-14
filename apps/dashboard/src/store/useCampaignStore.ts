import { create } from 'zustand';

// Assuming types are provided by our backend/API definitions
import type { Campaign } from '@/types';

interface CampaignState {
    campaigns: Campaign[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchCampaigns: (apiCall: () => Promise<Campaign[]>) => Promise<void>;
    mutateCampaign: (apiCall: () => Promise<Campaign>) => Promise<void>;
    clearError: () => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
    campaigns: [],
    isLoading: false,
    error: null,

    fetchCampaigns: async (apiCall) => {
        set({ isLoading: true, error: null });
        try {
            const data = await apiCall();
            set({ campaigns: data, isLoading: false });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch campaigns', isLoading: false });
        }
    },

    mutateCampaign: async (apiCall) => {
        // Optimistic UI updates can be orchestrated here before the API call resolves
        set({ isLoading: true, error: null });
        try {
            const updatedCampaign = await apiCall();
            set((state) => ({
                campaigns: state.campaigns.map((c) =>
                    c.id === updatedCampaign.id ? updatedCampaign : c
                ),
                isLoading: false
            }));
        } catch (err: any) {
            set({ error: err.message || 'Mutation failed', isLoading: false });
        }
    },

    clearError: () => set({ error: null })
}));