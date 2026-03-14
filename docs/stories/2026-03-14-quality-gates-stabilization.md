# Story: Quality Gates Stabilization (Monorepo)

## Context
- Follow-up requested to make repository quality gates executable end-to-end.
- Goal: restore `lint`, `typecheck`, and `test` at the monorepo root.

## Acceptance Checklist
- [x] Fix blocking lint errors in dashboard files touched during parallel edits.
- [x] Add and wire root `typecheck` pipeline via Turbo.
- [x] Stabilize API test execution without broken Nest testing bootstrap dependency.
- [x] Ensure root quality commands execute successfully.
- [x] Fix production build blockers in dashboard (`client/server` boundary and module exports).

## Quality Gates
- [x] `npm run lint` (passes with warnings in `apps/api`; no lint errors)
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `cd apps/dashboard && npm run build`

## File List
- [x] `package.json`
- [x] `turbo.json`
- [x] `apps/dashboard/package.json`
- [x] `apps/dashboard/src/app/(dashboard)/settings/meta/MetaAccountsClient.tsx`
- [x] `apps/dashboard/src/app/api/webhooks/stripe/route.ts`
- [x] `apps/dashboard/src/components/StateBoundary.tsx`
- [x] `apps/dashboard/src/lib/dashboard/queries.ts`
- [x] `apps/dashboard/src/lib/validation.ts`
- [x] `apps/dashboard/src/components/layout/GlobalStatusOverlay.tsx`
- [x] `apps/api/eslint.config.mjs`
- [x] `apps/api/package.json`
- [x] `apps/api/src/app.controller.spec.ts`
- [x] `apps/api/src/test-database.ts`
