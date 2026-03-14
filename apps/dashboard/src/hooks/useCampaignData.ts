import { useEffect } from 'react';
import { useCampaignStore } from '@/store/useCampaignStore';

// Assume this is the fetcher provided by the backend team
import { getCampaigns } from '@/api/campaigns';

export const useCampaignData = () => {
    const { campaigns, isLoading, error, fetchCampaigns, clearError } = useCampaignStore();

    useEffect(() => {
        // Only fetch if we don't already have data to prevent unnecessary renders,
        // or implement proper revalidation logic depending on the caching strategy.
        if (campaigns.length === 0 && !isLoading) {
            fetchCampaigns(getCampaigns);
        }
    }, [campaigns.length, isLoading, fetchCampaigns]);

    return {
        campaigns,
        isLoading,
        error,
        isEmpty: !isLoading && !error && campaigns.length === 0,
        clearError
    };
};