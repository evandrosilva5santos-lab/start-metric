import React, { ReactNode } from 'react';

// Note: The actual visual implementations (Skeleton, ErrorMsg) 
// are delegated to the Design Lead's UI library.
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ErrorAlert } from './ui/ErrorAlert';
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
        return (
            <div className="w-full">
                <SkeletonCard />
            </div>
        );
    }

    if (error) {
        return <ErrorAlert message={error} recoverable />;
    }

    if (isEmpty) {
        // Fazemos o cast para 'any' para evitar que o TS reclame caso o EmptyState espere apenas title/description
        const Empty = EmptyState as any;
        return <Empty title="No data" description={emptyMessage} message={emptyMessage} action={emptyAction} />;
    }

    return <>{children}</>;
};