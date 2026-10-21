"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ErrorAlertProps {
    message: string;
    recoverable?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, recoverable }) => {
    return (
        <div className="glass border-danger/20 bg-danger-tint p-5 rounded-3xl flex items-start gap-4 w-full">
            <div className="p-2.5 bg-danger-tint rounded-2xl text-danger shrink-0">
                <AlertTriangle size={20} />
            </div>
            <div className="mt-0.5">
                <p className="text-sm font-semibold text-danger">{message}</p>
                {recoverable && (
                    <p className="text-xs text-danger mt-1">Por favor, tente novamente.</p>
                )}
            </div>
        </div>
    );
};