# Security Guardian Audit - RLS, API Auth, Data Privacy

Date: 2026-03-15
Role: Security Guardian
Scope: RLS policies, API authentication middleware, environment variable/privacy audit

## Skills executed
- frontend-security-coder
- api-security-best-practices
- frontend-mobile-security-xss-scan
- security-auditor (used as fallback for requested `security-audit`)

## Findings (ordered by severity)

### 1) CRITICAL - Stripe webhook can be called without signature and uses non-standard verification
- File: `apps/dashboard/src/app/api/webhooks/stripe/route.ts`
- Evidence:
  - Verification only runs when header exists (`if (signature && !verify...)`), so missing signature is accepted.
  - Verification algorithm compares full header string and does not validate Stripe signed payload format (`t.payload`).
  - Endpoint uses `SUPABASE_SERVICE_ROLE_KEY`, increasing blast radius if abused.
- Risk:
  - Unauthenticated write path into `sales_orders`/`conversions` with service-role privileges.
- Recommendation:
  - Require signature header unconditionally in production.
  - Implement Stripe-compatible signature verification (timestamp + v1 signatures + constant-time compare) or use official Stripe SDK verification.

### 2) HIGH - Cron auth allows header-based bypass in production (`x-vercel-cron`)
- Files:
  - `apps/dashboard/src/app/api/cron/meta-sync/route.ts`
  - `apps/dashboard/src/app/api/cron/alerts-monitor/route.ts`
- Evidence:
  - Requests are authorized when `process.env.VERCEL && x-vercel-cron === "1"`.
- Risk:
  - If this header is spoofable from external requests, cron endpoints can be triggered without shared secret.
- Recommendation:
  - Require `CRON_SECRET` validation (Authorization Bearer) for all non-internal calls.
  - Remove header-only bypass, or pair with additional non-spoofable control.

### 3) HIGH - JWT secret has insecure fallback (`dev-secret`)
- Files:
  - `apps/api/src/auth/auth.module.ts`
  - `apps/api/src/auth/jwt.strategy.ts`
- Evidence:
  - `process.env.SUPABASE_JWT_SECRET || 'dev-secret'`
- Risk:
  - If env is missing, tokens can be forged with known fallback secret.
- Recommendation:
  - Fail fast on startup when `SUPABASE_JWT_SECRET` is missing outside explicit local-development mode.

### 4) MEDIUM - Client auth page logs env-derived values and auth telemetry to browser console
- File: `apps/dashboard/src/app/auth/AuthPageClient.tsx`
- Evidence:
  - Logs of env presence and URL prefix.
  - Detailed signup/auth logs and response metadata.
- Risk:
  - Information leakage in shared devices, support recordings, or browser telemetry extensions.
- Recommendation:
  - Remove debug logs or gate with strict development-only flag.

### 5) MEDIUM - Sensitive app secret used as operational token placeholder
- File: `apps/api/src/campaigns/campaigns.controller.ts`
- Evidence:
  - `const token = process.env.META_APP_SECRET || ''` for campaign update operations.
- Risk:
  - Secret misuse and accidental disclosure through downstream logging/diagnostics.
- Recommendation:
  - Use per-account encrypted access token from store; never pass app secret as bearer token.

### 6) MEDIUM (governance drift) - Consolidated migration enables RLS for sales tables but does not define sales policies
- File: `MIGRATIONS_CONSOLIDATED.sql`
- Evidence:
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` exists for sales tables.
  - No `sales_orders_*` / `sales_order_items_*` policies in consolidated script.
- Risk:
  - Drift between consolidated bootstrap and incremental migrations, causing environment inconsistency.
- Recommendation:
  - Merge `20260315030000_data_layer_hardening_realtime.sql` RLS policy blocks into consolidated baseline.

## Positive checks
- No direct `dangerouslySetInnerHTML` / raw HTML DOM injection patterns detected in frontend scan paths.
- Most Next API routes enforce user auth (`supabase.auth.getUser()`) or explicit scheduler auth paths.
- Latest sales hardening migration includes proper org-scoped RLS policies tied to `current_org_id()`.

## Priority remediation sequence
1. Fix Stripe webhook verification and mandatory signature requirement.
2. Remove/strengthen cron header bypass path.
3. Remove JWT fallback secret and enforce required env on startup.
4. Remove frontend debug logs with auth/env metadata.
5. Align consolidated migration with current sales RLS policies.
