"use client";

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ErrorAlertProps {
    message: string;
    recoverable?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, recoverable }) => {
    return (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="ml-3">
                <p className="text-sm text-red-700">{message}</p>
                <div className="glass border-red-500/20 bg-red-500/10 p-5 rounded-3xl flex items-start gap-4 w-full">
                    <div className="p-2.5 bg-red-500/20 rounded-2xl text-red-400 shrink-0">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="mt-0.5">
                        <p className="text-sm font-semibold text-red-200">{message}</p>
                        {recoverable && (
                            <>
                                <p className="text-xs text-red-500 mt-1">Please try again.</p>
                                <p className="text-xs text-red-400/80 mt-1">Por favor, tente novamente.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};