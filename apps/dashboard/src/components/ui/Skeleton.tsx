import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/[0.04] animate-pulse border border-white/5",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-[164px] rounded-3xl", className)} />;
}

export function SkeletonChart({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-[380px] lg:h-[410px] rounded-3xl", className)} />;
}

export function SkeletonTable({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-[480px] rounded-[2rem]", className)} />;
}

export function SkeletonKpi({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "glass glass-2 rounded-[2rem] p-6 border-white/10 relative overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      {/* Icon placeholder */}
      <div className="w-12 h-12 rounded-2xl bg-white/5 mb-4 animate-pulse border border-white/5" />
      {/* Value placeholder */}
      <div className="h-8 w-36 bg-white/5 rounded-xl mb-2 animate-pulse" />
      {/* Title placeholder */}
      <div className="h-4 w-24 bg-white/5 rounded-lg mb-4 animate-pulse" />
      {/* Trend placeholder */}
      <div className="h-3 w-20 bg-white/5 rounded-lg animate-pulse" />

      {/* Shine effect */}
      <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shine pointer-events-none" />
    </div>
  );
}
