# Diagnóstico de Deploy Vercel - Start Metric

**Data:** 2026-03-18
**Status:** 🔴 CRÍTICO - Build falhando
**Responsável:** DevOps Agent (@devops / Gage)

---

## 📊 RESUMO EXECUTIVO

O projeto **Start Metric** está configurado para deploy na Vercel, mas o build está falhando devido a problemas de código que não impedem o desenvolvimento local (dev mode) mas falham em produção.

**Build Local:** ✅ PASSOU (após correções)
**Build Vercel:** 🔄 AGUARDANDO CORREÇÕES

---

## 1. CONFIGURAÇÃO ATUAL

### 1.1 Branch/Projeto Alvo

| Item | Valor |
|------|-------|
| **Branch** | `main` |
| **Repositório** | `evandrosilva5santos-lab/start-metric` |
| **Vercel Project ID** | `prj_IP5D0g6svenC7k0uWJgOxgAoSK8m` |
| **Vercel Org ID** | `team_EfPBrSPjQYwdRzDAxGY6r90I` |
| **Project Name** | `start-metric` |

### 1.2 Build Command e Root Directory

**Configuração Atual** (`vercel.json` na raiz):

```json
{
  "buildCommand": "cd apps/dashboard && npm run build",
  "outputDirectory": "apps/dashboard/.next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Problema Identificado:** ❌ Build command inválido

O Vercel está executando `npm run build` na raiz do monorepo, mas deveria executar dentro de `apps/dashboard`.

### 1.3 Cache e Variáveis

**Variáveis de Ambiente Configuradas:**

| Variável | Status | Observação |
|----------|--------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ OK | Configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ OK | Configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ OK | Configurada |
| `META_APP_ID` | ✅ OK | Configurada |
| `META_APP_SECRET` | ✅ OK | Configurada |
| `SUPABASE_ENCRYPTION_KEY` | ⚠️ WARNING | Verificar valor |
| `CRON_SECRET` | ⚠️ WARNING | Verificar valor |

**Variáveis FALTANDO para produção:**

- `NODE_ENV=production` - **CRÍTICO**
- `META_REDIRECT_URI` - Deve apontar para domínio de produção
- `NEXT_PUBLIC_APP_URL` - URL base da aplicação

---

## 2. PROBLEMAS IDENTIFICADOS

### 2.1 Erro de Build Principal

**Erro Original:**
```
Command "npm run build" exited with 1
```

**Causa Raiz:** Problemas de código que falham TypeScript em produção:

1. **`criativos/page.tsx:30:16`** - `ImageIcon` não importado
2. **`reports/page.tsx:38`** - Tabela `scheduled_reports` não existe no banco

### 2.2 Diferenças Local vs Cloud

| Aspecto | Local | Vercel | Status |
|---------|-------|--------|--------|
| **Node Version** | Sistema | 24.x (configurado) | ✅ |
| **Build Command** | Manual | `npm run build` (raiz) | ❌ |
| **Environment** | Development | Production | ❌ |
| **Type Checking** | Parcial (dev) | Completo (build) | ❌ |
| **Lock Files** | Local | npm ci | ⚠️ |

---

## 3. CORREÇÕES APLICADAS

### 3.1 Correção 1: Import de ImageIcon

**Arquivo:** `apps/dashboard/src/app/(dashboard)/criativos/page.tsx`

**Antes:**
```typescript
import { Zap } from "lucide-react";
// ...
<ImageIcon size={40} />
```

**Depois:**
```typescript
import { Image, Zap } from "lucide-react";
// ...
<Image size={40} />
```

### 3.2 Correção 2: Tabelas Futuras (Sprint 5)

**Arquivo:** `apps/dashboard/src/app/(dashboard)/reports/page.tsx`

**Alteração:** Comentado acesso a tabelas que ainda não existem

```typescript
// NOTA: Funcionalidade de relatórios agendados será implementada na Sprint 5
// As tabelas scheduled_reports e report_executions ainda não existem no banco
async function getReportsData(orgId: string) {
  // Temporariamente retornar arrays vazios até as tabelas serem criadas
  return {
    reports: [] as ScheduledReportRow[],
    executions: [] as ReportExecutionRow[],
  };
}
```

---

## 4. PLANO DE CORREÇÃO

### 4.1 Correções de Build (IMEDIATO)

#### Ajustar vercel.json

**Alteração necessária:**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Mover `vercel.json` para `apps/dashboard/vercel.json`**

#### Configurar Root Directory

Na configuração do projeto Vercel (dashboard ou CLI):

```json
{
  "rootDirectory": "apps/dashboard"
}
```

#### Adicionar Variáveis de Produção

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://startmetric.com  # ou domínio real
META_REDIRECT_URI=https://startmetric.com/api/meta/callback
```

### 4.2 Configuração de Ignição (Zero Config)

O Next.js 16+ tem suporte melhor à Vercel, mas precisa de ajuste:

**Verificar se `.vercelignore` existe:**

```gitignore
node_modules
.git
.env*.local
```

### 4.3 Deploy Manual

Para testar após correções:

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login (primeira vez)
vercel login

# Deploy de produção
cd apps/dashboard
vercel --prod
```

---

## 5. CHECKLIST DE VALIDAÇÃO PÓS-DEPLOY

### Pré-Deploy

- [ ] Build local passa: `cd apps/dashboard && NODE_ENV=production npm run build`
- [ ] Lint passa: `npm run lint`
- [ ] Typecheck passa: `npm run typecheck`
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] `vercel.json` movido para `apps/dashboard/`
- [ ] Root directory configurado para `apps/dashboard`

### Pós-Deploy

- [ ] URL de produção está acessível
- [ ] Login funciona com credenciais reais
- [ ] Conexão Supabase está funcionando
- [ ] Meta OAuth callback funciona
- [ ] API routes respondem corretamente
- [ ] Assets estáticos carregam
- [ ] Console sem erros (browser + server logs)

### Monitoramento

- [ ] Verificar logs na Vercel (tab "Build Logs")
- [ ] Verificar Function Logs (tab "Logs")
- [ ] Testar cron jobs (/api/cron/*)
- [ ] Verificar deploy time

---

## 6. RISCOS IDENTIFICADOS

### 🔴 CRÍTICOS

1. **Build Command Incorreto** - Vercel não consegue encontrar o Next.js app
   - **Impacto:** Deploy falha completamente
   - **Mitigação:** Mover `vercel.json` e configurar root directory

2. **Variáveis de Ambiente Faltando** - `NODE_ENV` não configurado
   - **Impacto:** Comportamento inconsistente local vs prod
   - **Mitigação:** Adicionar todas as variáveis listadas

### 🟡 MÉDIOS

3. **Tabelas de Banco Não Criadas** - `scheduled_reports`, `report_executions`
   - **Impacto:** Página /reports quebra em produção
   - **Mitigação:** Código já corrigido para retornar arrays vazios

4. **Meta Redirect URI hardcoded** - Aponta para localhost
   - **Impacto:** OAuth callback falha em produção
   - **Mitigação:** Configurar variável `META_REDIRECT_URI`

### 🟢 BAIXOS

5. **Cache de Build** - Vercel pode reusar cache incorreto
   - **Impacto:** Build inconsistente
   - **Mitigação:** Limpar cache se necessário (Redeploy)

---

## 7. PRÓXIMOS PASSOS

### Imediato (Hoje)

1. ✅ Corrigir erros de código (FEITO)
2. [ ] Mover `vercel.json` para `apps/dashboard/`
3. [ ] Configurar root directory na Vercel
4. [ ] Adicionar variáveis de ambiente
5. [ ] Testar deploy manual

### Curto Prazo (Esta semana)

6. [ ] Criar migration para tabelas de relatórios (Sprint 5)
7. [ ] Configurar domínio customizado
8. [ ] Implementar testes E2E
9. [ ] Configurar CI/CD automático

### Médio Prazo (Sprint 6)

10. [ ] Implementar retry logic para APIs externas
11. [ ] Adicionar observabilidade (Sentry/DataDog)
12. [ ] Configurar health checks
13. [ ] Documentar runbooks de incidentes

---

## 8. LOG DE MUDANÇAS

### 2026-03-18 - Correções de Build

**Arquivos Modificados:**

1. `apps/dashboard/src/app/(dashboard)/criativos/page.tsx`
   - Corrigido import de `ImageIcon` → `Image`

2. `apps/dashboard/src/app/(dashboard)/reports/page.tsx`
   - Comentado acesso a tabelas futuras
   - Adicionado TODO para Sprint 5

**Build Status:** ✅ PASSANDO localmente

---

## 9. REFERÊNCIAS

- **Vercel Docs:** https://vercel.com/docs/frameworks/nextjs
- **Next.js Deploy:** https://nextjs.org/docs/deployment
- **Project PRD:** `/PRD.md`
- **Execution Plan:** `/EXECUTION_PLAN.md`

---

**Próxima Revisão:** Após primeiro deploy bem-sucedido
