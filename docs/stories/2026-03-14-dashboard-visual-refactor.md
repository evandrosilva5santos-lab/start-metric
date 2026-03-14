# Story: Dashboard Visual Refactor (2026 Premium UI)

## Context
- Requested by Design Lead mission: elevate dashboard visuals with Tailwind + Framer Motion.
- Scope intentionally limited to visual/front-end layers only.
- No backend logic, database, or infrastructure changes.

## Visual Audit (Before)
- Good baseline glass style and motion language, but layout density was mostly linear, not modular bento.
- Some decorative animation classes were referenced but not defined (`animate-float`, `animate-scan`, `animate-pulse-fast`).
- KPI, chart, and summary blocks lacked hierarchy contrast for premium “command center” readability.
- Filters were visually functional but low-context (no explicit field labels in compact mode).

## Refactor Proposal (Applied)
- Recompose dashboard into a modular bento grid (KPI slabs + 8/4 analytics split).
- Upgrade glassmorphism depth with layered gradients, inner highlights, and ambient aurora background.
- Add stronger HUD status chips and micro-motion cues while preserving reduced-motion support.
- Standardize card radii/spacing to a more premium 2026 visual cadence.
- Keep all existing data/query/action logic intact.
- Consolidate parallel AI contributions into a single interface-state strategy (global loading/error + local campaign domain state hooks/stores).

## Acceptance Checklist
- [x] Audit current dashboard visual state.
- [x] Apply modular bento layout to KPI and analytics sections.
- [x] Strengthen glassmorphism treatment and ambient backgrounds.
- [x] Preserve existing data flow and business behavior.
- [x] Keep changes in front-end visual surfaces only.
- [x] Review and normalize Claude/Gemini parallel changes in `components/hooks/store`.
- [x] Ensure loading/error states are integrated with global UI state manager.
- [x] Remove placeholder imports/types that broke compilation in new hooks/stores.

## Quality Gates
- [x] `npm run lint` (passou; warnings não bloqueantes no `apps/api`)
- [x] `npm run typecheck` (passou no monorepo com `turbo run typecheck`)
- [x] `npm test` (passou; suíte Jest do `apps/api` verde)

## File List
- [x] `apps/dashboard/src/app/globals.css`
- [x] `apps/dashboard/src/components/alerts/AlertRulesConfig.tsx`
- [x] `apps/dashboard/src/components/dashboard/CampaignsTable.tsx`
- [x] `apps/dashboard/src/components/dashboard/DashboardClient.tsx`
- [x] `apps/dashboard/src/components/dashboard/DashboardFilters.tsx`
- [x] `apps/dashboard/src/components/dashboard/KpiGrid.tsx`
- [x] `apps/dashboard/src/components/layout/GlobalStatusOverlay.tsx`
- [x] `apps/dashboard/src/components/dashboard/PerformanceChart.tsx`
- [x] `apps/dashboard/src/components/dashboard/PeriodSummary.tsx`
- [x] `apps/dashboard/src/hooks/useAppQuery.ts`
- [x] `apps/dashboard/src/hooks/useReducedMotion.ts`
- [x] `apps/dashboard/src/store/ui-store.ts`
- [x] `apps/dashboard/src/components/ui/Skeleton.tsx`
- [x] `apps/dashboard/src/components/ui/StatCard.tsx`
- [x] `apps/dashboard/src/components/StateBoundary.tsx`
- [x] `apps/dashboard/src/components/ui/ErrorAlert.tsx`
- [x] `apps/dashboard/src/components/ui/SkeletonLoader.tsx`
- [x] `apps/dashboard/src/hooks/useCampaignData.ts`
- [x] `apps/dashboard/src/store/useCampaignStore.ts`
- [x] `apps/dashboard/src/components/campaigns.ts`
- [x] `apps/api/src/test-database.ts`
