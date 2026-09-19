import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonLoaderProps {
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className }) => {
  return (
    <div className={cn("animate-pulse flex space-x-4 p-4 glass rounded-2xl border-white/5", className)}>
      <div className="flex-1 space-y-3 py-1">
        <div className="h-4 bg-white/5 rounded-lg w-3/4" />
        <div className="space-y-2">
          <div className="h-3 bg-white/5 rounded-lg" />
          <div className="h-3 bg-white/5 rounded-lg w-5/6" />
        </div>
      </div>
    </div>
  );
};