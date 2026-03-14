"use client";

import { useEffect } from 'react';
import { useCampaignStore } from '@/store/useCampaignStore';
import type { DashboardCampaignRow as Campaign } from '@/lib/dashboard/types';

type UseCampaignDataOptions = {
    autoFetch?: boolean;
};

export const useCampaignData = (
    fetcher?: () => Promise<Campaign[]>,
    options: UseCampaignDataOptions = {},
) => {
    const { autoFetch = true } = options;
    const { campaigns, isLoading, hasInitialFetch, error, fetchCampaigns, clearError } = useCampaignStore();

    useEffect(() => {
        if (!autoFetch || !fetcher) return;
        if (!hasInitialFetch && !isLoading) {
            void fetchCampaigns(fetcher);
        }
    }, [autoFetch, fetcher, hasInitialFetch, isLoading, fetchCampaigns]);

    const refetch = async () => {
        if (!fetcher) return;
        await fetchCampaigns(fetcher);
    };

    return {
        campaigns,
        isLoading,
        error,
        isEmpty: !isLoading && !error && campaigns.length === 0,
        clearError,
        refetch,
    };
};
