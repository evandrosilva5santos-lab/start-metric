import React, { ReactNode } from 'react';

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
        return (
            <div className="space-y-4">
                <EmptyState title="No data" description={emptyMessage} />
                {emptyAction ? <div className="flex justify-center">{emptyAction}</div> : null}
            </div>
        );
    }

    return <>{children}</>;
};
