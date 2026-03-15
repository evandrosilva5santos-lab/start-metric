# Story: Security Guardian Audit (RLS, API Auth, Data Privacy)

## Context
- Mission: perform security/governance audit with focus on RLS, API authentication, and environment-variable/privacy exposure.
- Requested skills executed: `frontend-security-coder`, `api-security-best-practices`, `frontend-mobile-security-xss-scan`, and `security-audit` fallback via `security-auditor`.

## Acceptance Checklist
- [x] Audit RLS policy definitions and consistency across migrations.
- [x] Audit authentication enforcement in API routes and middleware.
- [x] Audit environment variable handling and potential secret exposure paths.
- [x] Run frontend XSS pattern scan over dashboard code.
- [x] Produce prioritized findings with actionable remediation.
- [x] Register audit report in `/docs/security`.

## Quality Gates
- [ ] Not applicable (read-only security audit; no runtime code changes executed).

## File List
- [x] `docs/security/2026-03-15-security-guardian-audit.md`
- [x] `docs/stories/2026-03-15-security-guardian-audit.md`
