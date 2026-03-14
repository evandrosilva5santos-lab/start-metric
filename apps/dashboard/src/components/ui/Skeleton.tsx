"use client";

import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("rounded-2xl bg-white/[0.04] animate-pulse border border-white/10", className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return <Skeleton className="h-[164px] rounded-3xl" />;
}

export function SkeletonChart({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-[380px] rounded-3xl", className)} />;
}

export function SkeletonTable() {
  return <Skeleton className="h-[420px] rounded-3xl" />;
}
