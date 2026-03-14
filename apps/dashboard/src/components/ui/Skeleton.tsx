"use client";

import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("rounded-xl bg-white/[0.04] animate-pulse", className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return <Skeleton className="h-[156px] rounded-2xl" />;
}

export function SkeletonChart({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-[380px] rounded-2xl", className)} />;
}

export function SkeletonTable() {
  return <Skeleton className="h-[420px] rounded-2xl" />;
}
