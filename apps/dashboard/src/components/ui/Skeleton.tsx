import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-subtle animate-pulse border border-border",
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
        "rounded-2xl border border-border bg-card p-5 relative overflow-hidden",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-28 bg-subtle rounded-md animate-pulse" />
        <div className="w-8 h-8 rounded-lg bg-subtle animate-pulse" />
      </div>
      <div className="h-8 w-36 bg-subtle rounded-lg mb-2 animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="h-4 w-14 bg-subtle rounded-md animate-pulse" />
        <div className="h-3 w-20 bg-subtle rounded-md animate-pulse" />
      </div>
    </div>
  );
}

export function SkeletonKpiGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SkeletonKpi />
      <SkeletonKpi />
      <SkeletonKpi />
      <SkeletonKpi />
    </div>
  );
}

export function SkeletonCreativeGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="h-48 w-full bg-subtle animate-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 bg-subtle rounded-md animate-pulse" />
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
              <div className="h-8 bg-subtle rounded-md animate-pulse" />
              <div className="h-8 bg-subtle rounded-md animate-pulse" />
              <div className="h-8 bg-subtle rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeatmap() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="h-5 w-48 bg-subtle rounded-md mb-6 animate-pulse" />
      <div className="grid grid-cols-24 gap-1.5 h-64 w-full">
        {Array.from({ length: 24 * 7 }).map((_, i) => (
          <div key={i} className="bg-subtle rounded-sm animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGarimpoGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-5 w-20 bg-subtle rounded-full animate-pulse" />
            <div className="h-5 w-24 bg-subtle rounded-md animate-pulse" />
          </div>
          <div className="h-44 w-full bg-subtle rounded-xl animate-pulse" />
          <div className="h-4 w-5/6 bg-subtle rounded-md animate-pulse" />
          <div className="h-9 w-full bg-subtle rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  );
}
