# Sprint 5 — Report Templates — Diagnóstico Completo

**Data:** 2026-03-20
**Status:** Em andamento (~55% completo)
**Commit:** (S5.4 implementado)

---

## Resumo Executivo

A Sprint 5 implementa o sistema completo de templates de relatórios reutilizáveis. O gestor cria um template com métricas selecionadas e uma mensagem com variáveis dinâmicas (`{{client_name}}`, `{{roas}}`, `{{spend}}`). O template é salvo e pode ser reutilizado para qualquer cliente.

**Progresso atual:** 55%
- ✅ Backend core (migration, renderer, variables builder)
- ✅ API Routes (7 endpoints) - S5.4 COMPLETO
- ❌ UI Frontend (3 páginas + 4 componentes)
- ❌ Seed de templates padrão

---

## ✅ O Que Já Foi Feito

### S5.1 — Migration: `report_templates`
**Arquivo:** `apps/dashboard/supabase/migrations/20260319000000_update_report_templates.sql`

```sql
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS message_template TEXT,
  ADD COLUMN IF NOT EXISTS metrics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Comentários e índices criados
```

**Status:** ✅ 100% completo e testado

---

### S5.2 — Motor de Render
**Arquivo:** `packages/reports/src/renderer.ts`

**Funções implementadas:**
- `renderTemplate(template, variables)` → Substitui `{{variavel}}` por valor
- `formatVariables(raw)` → Formata números em BRL, %, x
- `formatPeriod(from, to)` → Formata período em PT-BR

**Status:** ✅ 100% completo

---

### S5.3 — Variables Builder
**Arquivo:** `packages/reports/src/variables.ts`

**Função implementada:**
- `buildVariables(supabase, orgId, clientId, dateRange)` → Busca métricas reais e constrói objeto de variáveis

**Status:** ✅ 100% completo

---

## ❌ O Que Ainda Falta

### S5.4 — API Routes (7 endpoints) ✅ COMPLETO

**Arquivos criados:**
```
apps/dashboard/src/app/api/reports/templates/
├── route.ts                          ✅ CRIADO (GET list, POST create)
├── [id]/
│   ├── route.ts                      ✅ CRIADO (GET detail, PATCH update, DELETE)
│   ├── duplicate/
│   │   └── route.ts                  ✅ CRIADO (POST duplicate)
│   └── preview/
│       └── route.ts                  ✅ CRIADO (POST preview)
```

**Endpoints implementados:**

| Método | Rota | Status |
|--------|------|--------|
| GET | `/api/reports/templates` | ✅ Listar templates da org |
| POST | `/api/reports/templates` | ✅ Criar novo template |
| GET | `/api/reports/templates/[id]` | ✅ Detalhes do template |
| PATCH | `/api/reports/templates/[id]` | ✅ Editar template |
| DELETE | `/api/reports/templates/[id]` | ✅ Deletar template |
| POST | `/api/reports/templates/[id]/duplicate` | ✅ Duplicar template |
| POST | `/api/reports/templates/[id]/preview` | ✅ Preview com dados reais |

**Validações Zod implementadas:**
- Create: `name` (required), `description?`, `message_template?`, `metrics?`, `is_default?`
- Update: Partial update dos campos acima
- Preview: `client_id` (required), `date_from`, `date_to`

**Detalhes da implementação:**
- Autenticação via Supabase auth
- Verificação de org_id para garantir isolamento
- Zod schemas para validação
- Preview usa `buildVariables` e `renderTemplate` do @start-metric/reports
- Delete TODO: verificar scheduled_reports quando tabela existir

---

### S5.5 — UI: Página de Templates

**Estrutura de diretórios:**
```
apps/dashboard/src/app/(dashboard)/reports/templates/
├── page.tsx                          ← CRIAR (grid de cards)
├── [id]/
│   └── page.tsx                      ← CRIAR (detalhe/editar)
└── new/
    └── page.tsx                      ← CRIAR (criar novo)
```

**Responsabilidades:**
- Grid de cards com: nome, descrição, nº de métricas, data criação
- Ações: editar, duplicar, deletar
- Card destacado para `is_default=true`
- Botão "Novo Template"
- Link para edição/criação

---

### S5.6 — UI: Editor de Template (4 componentes)

**Estrutura de diretórios:**
```
apps/dashboard/src/components/reports/
├── TemplateEditor.tsx                ← CRIAR (principal)
├── MetricsPicker.tsx                 ← CRIAR
├── VariablesToolbar.tsx              ← CRIAR
└── TemplatePreview.tsx               ← CRIAR
```

#### MetricsPicker.tsx
Grupos de métricas com checkboxes:

**💰 Financeiro:**
- [ ] Investimento Total (`total_spend`)
- [ ] Receita Atribuída (`total_revenue`)
- [ ] ROAS (`roas`)
- [ ] CPA (`cpa`)
- [ ] ROI (`roi`)
- [ ] Lucro Bruto (`gross_profit`)

**📊 Alcance:**
- [ ] Impressões (`impressions`)
- [ ] Cliques (`clicks`)
- [ ] CTR (`ctr`)
- [ ] CPM (`cpm`)
- [ ] CPC (`cpc`)

**🎯 Conversões:**
- [ ] Total de Conversões (`conversions`)

**📱 Destaque:**
- [ ] Melhor Campanha (`best_campaign`)
- [ ] Pior Campanha (`worst_campaign`)

#### VariablesToolbar.tsx
Chips clicáveis que inserem `{{variavel}}` no cursor do textarea:

```tsx
// Estilo: bg-slate-800 hover:bg-cyan-400/10 border border-slate-700
{{client_name}} | {{period}} | {{total_spend}} | {{total_revenue}} | {{roas}} ...
```

#### TemplatePreview.tsx
- Select "Simular com dados de:" (dropdown de clientes)
- Opção "Dados de exemplo" (mock)
- Preview renderizado em card com whitespace-pre-wrap
- Variáveis não encontradas em vermelho

#### TemplateEditor.tsx
Layout 2 colunas (lg:grid-cols-2 gap-6):

**Coluna Esquerda:**
1. Campo Nome
2. Campo Descrição (opcional)
3. MetricsPicker
4. VariablesToolbar
5. Textarea com message_template
6. Botão Salvar

**Coluna Direita:**
1. Select de cliente para preview
2. TemplatePreview
3. Botão "Enviar preview por WhatsApp" (só se WhatsApp conectado)

**Estados necessários:**
- `isSaving: boolean`
- `selectedMetrics: string[]`
- `messageTemplate: string`
- `previewClientId: string | null`
- `previewData: Record<string, string> | null`

---

### S5.7 — Templates Padrão (Seed)

**Arquivo:** `apps/dashboard/src/lib/reports/seed-templates.ts`

**Função:** Criar 2-3 templates de exemplo no onboarding

**Templates sugeridos:**

1. **Relatório Semanal**
   - Métricas: total_spend, total_revenue, roas, cpa, ctr, conversions
   - Texto PT-BR com emoji

2. **Resumo de Campanha**
   - Métricas: roas, conversions, best_campaign, worst_campaign
   - Foco em performance

---

## Variáveis Disponíveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{client_name}}` | Nome do cliente | João Silva |
| `{{period}}` | Período do relatório | 01/03 a 07/03/2026 |
| `{{total_spend}}` | Total investido | R$ 5.230,00 |
| `{{total_revenue}}` | Receita atribuída | R$ 24.580,00 |
| `{{roas}}` | ROAS do período | 4,7x |
| `{{cpa}}` | Custo por aquisição | R$ 43,50 |
| `{{cpm}}` | CPM médio | R$ 12,30 |
| `{{ctr}}` | CTR médio | 2,4% |
| `{{cpc}}` | CPC médio | R$ 0,85 |
| `{{impressions}}` | Total de impressões | 425.000 |
| `{{clicks}}` | Total de cliques | 10.200 |
| `{{conversions}}` | Total de conversões | 120 |
| `{{best_campaign}}` | Melhor campanha | Campanha Black Friday |
| `{{worst_campaign}}` | Pior campanha | Campanha Remarketing |
| `{{roi}}` | ROI do período | 370% |
| `{{gross_profit}}` | Lucro bruto | R$ 19.350,00 |

---

## Critérios de Aceite

- [ ] Gestor consegue criar, editar e deletar templates
- [ ] Editor de template tem picker de métricas e toolbar de variáveis
- [ ] Preview exibe o template renderizado com dados reais de um cliente
- [ ] Motor de render substitui corretamente todas as variáveis
- [ ] Templates duplicados funcionam independentemente do original
- [ ] Templates padrão aparecem no onboarding

---

## Resumo de Arquivos

| Status | Tipo | Arquivos |
|--------|------|----------|
| ✅ Feito | Migration | 1 |
| ✅ Feito | Package | 2 (renderer.ts, variables.ts) |
| ✅ Feito | API Routes | 5 |
| ❌ Falta | Páginas UI | 3 |
| ❌ Falta | Componentes UI | 4 |
| ❌ Falta | Seed | 1 |
| **TOTAL** | | **16 arquivos** |

**Progresso:** 8/16 arquivos (~50%)
**Funcionalidade:** ~55% (core + APIs prontas, falta UI)

---

## Próximos Passos Sugeridos

1. ~~**S5.4 — API Routes** (backend primeiro)~~ ✅ COMPLETO
   - ~~Criar os 5 arquivos de rotas~~
   - ~~Implementar Zod validation~~
   - ~~Testar com curl/Postman~~

2. **S5.6 — UI Components** (frontend)
   - MetricsPicker (mais simples)
   - VariablesToolbar (mais simples)
   - TemplatePreview (médio)
   - TemplateEditor (mais complexo, depende dos anteriores)

3. **S5.5 — UI Pages** (integração)
   - /reports/templates/new (usa TemplateEditor)
   - /reports/templates/[id] (usa TemplateEditor)
   - /reports/templates (grid simples)

4. **S5.7 — Seed** (finalização)
   - Criar função de seed
   - Integrar no onboarding

---

## Referências

- **Sprint Document:** `docs/sprints/sprint-5-report-templates.md`
- **Migration:** `apps/dashboard/supabase/migrations/20260319000000_update_report_templates.sql`
- **Renderer:** `packages/reports/src/renderer.ts`
- **Variables:** `packages/reports/src/variables.ts`
