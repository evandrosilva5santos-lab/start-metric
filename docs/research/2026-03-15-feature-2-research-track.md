# Research Track - Feature 2 (Relatorios Inteligentes)

Date: 2026-03-15
Owner: R&D Lead
Scope: Technical intelligence + growth playbook for next feature planning

## 1) Context found in repository

- Current roadmap prioritizes Feature 1 completion, then Feature 2 (report generation).
- Current backend already has queue infrastructure in Nest (`@nestjs/bull` + `bull`).
- Current dashboard already uses cron-style endpoints for sync and alerts in Next route handlers.
- Feature 2 types already exist in `packages/types/src/index.ts` but schema and execution pipeline are not implemented.

## 2) Option analysis

### Option A - Keep report execution in Next route handlers + Vercel cron
Pros:
- Fastest short-term setup.
- No extra worker process at start.

Cons:
- Weak fit for long-running generation and dispatch chains.
- Harder retry orchestration and job-level observability.
- More risk of timeout and duplicate execution.

### Option B - Queue-driven pipeline in Nest (recommended)
Pros:
- Uses stack already present in monorepo.
- Better separation between request layer and execution layer.
- Native fit for retries, backoff, dead-letter style handling.
- Aligned with future WhatsApp automation worker requirements.

Cons:
- Requires explicit operational ownership for queue workers and Redis reliability.

### Option C - Supabase Queues (pgmq) as queue backbone
Pros:
- Lower infra sprawl if reducing Redis dependency is strategic.
- Queue payload/state co-located with Postgres.

Cons:
- Migration cost from current queue approach.
- Team already has working patterns with Bull in API.

## 3) Recommended architecture for Feature 2

- Bounded context: `Reporting`.
- API/Command side in `apps/api`:
  - `POST /reports/schedule`
  - `POST /reports/:id/run`
  - `GET /reports/executions`
- Worker side in `apps/api` queue processors:
  - `report.generate`
  - `report.dispatch`
- Query side for dashboard preview/history via read models.

### Canonical state machine

`pending -> generating -> completed|failed -> sent|failed`

### Mandatory non-functional patterns

- Tenant guard by `org_id` at all layers.
- Idempotency keys for schedule/run/send.
- Transactional outbox for reliable internal event publication.
- Correlation id for each report execution.

## 4) Library and platform intelligence (2026 check)

- BullMQ docs show scheduler APIs (`upsertJobScheduler`) for recurring jobs and queue orchestration.
- Inngest is strong for event-driven durable functions, but introduces a second async platform while current stack already has Bull/Nest.
- Temporal remains best-in-class for durable execution at large scale, but adds heavier operational and cognitive overhead for the current MVP phase.
- Stripe webhook guidance emphasizes signature verification and dedup/idempotency, reinforcing the need for idempotent report dispatch and webhook ingestion patterns.

## 5) Growth playbook for Feature 2

North Star (feature level):
- Percentage of active orgs with scheduled report delivered successfully in the last 7 days.

Activation metrics:
- `report_template_created_rate`
- `scheduled_report_activation_rate`
- `first_report_time_to_value`
- `scheduled_report_success_rate`
- `report_preview_to_schedule_conversion`

Experiment backlog:
1. Default starter template vs blank template.
2. Weekly schedule pre-selected vs manual frequency selection.
3. Report preview CTA wording and placement.

## 6) Decision summary

- Adopt Option B now (Nest queue pipeline), preserving room for BullMQ scheduler upgrade and later Supabase-queue evaluation.
- Keep Next dashboard routes as orchestration/read endpoints only.
- Implement Feature 2 in phases to protect Feature 1 completion and avoid architecture bifurcation.

## Sources

- BullMQ docs: https://docs.bullmq.io/guide/job-schedulers
- Inngest docs: https://www.inngest.com/docs
- Temporal docs: https://docs.temporal.io/temporal
- Stripe webhooks docs: https://docs.stripe.com/webhooks
- Vercel cron docs: https://vercel.com/docs/cron-jobs
- Next.js route handlers docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Supabase Queues docs: https://supabase.com/docs/guides/queues
- Transactional Outbox pattern: https://microservices.io/patterns/data/transactional-outbox
