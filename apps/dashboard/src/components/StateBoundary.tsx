import React, { ReactNode } from 'react';

// Note: The actual visual implementations (Skeleton, ErrorMsg) 
// are delegated to the Design Lead's UI library.
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';

interface StateBoundaryProps {
    isLoading: boolean;
    error: string | null;
    isEmpty: boolean;
    emptyMessage?: string;
    emptyAction?: ReactNode;
    children: ReactNode;
}

/**
 * StateBoundary intercepts the render lifecycle to automatically 
 * display Skeletons, Errors, or Empty states based on the passed props.
 */
export const StateBoundary: React.FC<StateBoundaryProps> = ({
    isLoading,
    error,
    isEmpty,
    emptyMessage = "No data available at the moment.",
    emptyAction,
    children
}) => {
    if (isLoading) {
        return <SkeletonLoader />;
    }

    if (error) {
        return <ErrorAlert message={error} recoverable />;
    }

    if (isEmpty) {
        return <EmptyState message={emptyMessage} action={emptyAction} />;
    }

    return <>{children}</>;
};