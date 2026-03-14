# 🧠 Start Metric - Context Memory

## 🚩 Last Restore Point: 2026-03-11
**Current Task**: Colocar `apps/dashboard` no ar (Vercel) e validar Meta OAuth + sync inicial
**Status**: 🏗️ Ajustando deploy (env vars + redirect URIs + cron)

## 📌 Technical Anchors
- **Auth**: Supabase SSR (@supabase/ssr) + Middleware ativo.
- **Integration**: Meta Ads OAuth (App ID: 1471696211057442).
- **Architecture**: Monorepo com apps/dashboard e apps/landing-page.
- **DB Strategy**: ADR-006 (Criptografia PGP no Postgres para tokens da Meta).
- **Vercel**: Projeto `start-metric` (aguardando vinculação).

## ⚠️ Critical Blocks
1. **Supabase migrations**: confirmar que `apps/dashboard/supabase/migrations` foi aplicado no projeto Supabase.
2. **Meta OAuth Redirect URIs**: cadastrar URIs de callback (localhost + Vercel) no painel do app Meta.
3. **Vercel env vars**: configurar todas as variaveis server-only (Meta secret, service role, encryption key, cron secret).

## 🎯 Next Step
Rodar build do monorepo e fazer smoke test em preview Vercel (/auth -> /settings/meta -> connect -> sync).

## 🌐 Infra & Links
- **GitHub remote**: `https://github.com/evandrosilva5santos-lab/start-metric`
- **Vercel account**: `evandrosilva5santos-7492s`
- **Vercel project**: `start-metric` (`prj_IP5D0g6svenC7k0uWJgOxgAoSK8m`)
- **Vercel project page**: `https://vercel.com/evandrosilva5santos-7492s-projects/start-metric`

## 🚀 Latest Deploy Attempt (Claimable Preview)
- **Preview URL**: `https://skill-deploy-4kp08nc6cb-codex-agent-deploys.vercel.app`
- **Claim URL**: `https://vercel.com/claim-deployment?code=577ed9ef-fad8-441f-bba0-79f76559d078`
- **Deployment ID**: `dpl_6uCXK4AfJszWAGWiruG7Xa6L6H48`
