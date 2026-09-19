import { SkeletonKpi, SkeletonChart, SkeletonTable } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 space-y-8 animate-fade-in" aria-busy="true" aria-label="Carregando métricas do dashboard">
      {/* Top Header Skeleton */}
      <div className="glass glass-2 rounded-[2rem] p-6 lg:p-7 border-white/10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div className="space-y-3">
          <div className="h-3 w-28 bg-white/5 rounded-full animate-pulse" />
          <div className="h-9 w-64 bg-white/5 rounded-2xl animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-6 w-32 bg-white/5 rounded-full animate-pulse" />
            <div className="h-6 w-36 bg-white/5 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-44 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* KPI Grid Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 lg:gap-5">
        <div className="xl:col-span-6">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-6">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
      </div>

      {/* Chart & Period Summary Skeletons */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8">
          <SkeletonChart className="h-[410px]" />
        </div>
        <div className="xl:col-span-4">
          <SkeletonChart className="h-[410px]" />
        </div>
      </div>

      {/* Campaigns Table Skeleton */}
      <SkeletonTable />
    </div>
  );
}
