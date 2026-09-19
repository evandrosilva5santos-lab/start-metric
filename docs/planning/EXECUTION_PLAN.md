# Plano de Execução — Start Metric (Sprint 4+)

**Data:** 2026-03-17
**Versão:** 1.0
**Status:** Pronto para executar

---

## 📊 RESUMO DO ESTADO ATUAL

### Sprint 0-3: ✅ COMPLETO (com bugs menores corrigidos)
- ✅ Sprint 0: Fundação + Perfil (COMPLETO)
- ✅ Sprint 1: Client Management (COMPLETO — bugs corrigidos em Sprint 3 cont.)
- ✅ Sprint 2: Meta API Real (COMPLETO)
- ✅ Sprint 3: Analytics Engine (COMPLETO)

### Bugs Corrigidos Hoje
- ✅ `/api/clients` — ad_accounts(count) resiliente com fallback
- ✅ `/api/meta/accounts` — retorna `{ data: accounts }` corretamente
- ✅ `ClientModal.tsx` — consegue ler `result.data`
- ✅ Arquivos .md obsoletos removidos
- ✅ Commit 320dc7f3 feito push para origin/main

### Próximo Passo: Sprint 4 (Cliente Final Portal)
**Foco:** Deixar clientes acessarem dashboards compartilhados sem login

---

## 🎯 SPRINT 4: CLIENT PORTAL (CAMADA 3)

**Duração estimada:** 2 semanas
**Dependências:** Sprint 0-3 completos ✅
**Prioridade:** 🔴 CRÍTICO

### O que você vai entregar

```
Seu cliente pode compartilhar link: https://startmetric.com/shared/dashboard/abc123xyz
Cliente final clica no link → vê dashboard só-leitura com marca branca → baixa PDF
Tudo sem fazer login! 🎉
```

---

## 📋 PASSO A PASSO DE EXECUÇÃO (SPRINT 4)

### FASE 1: BANCO DE DADOS (1 dia)

#### Passo 1.1: Criar migration SQL
**Arquivo:** `supabase/migrations/[TIMESTAMP]_create_shared_links.sql`

```bash
# Copiar o SQL de docs/SPRINT_4_CLIENT_PORTAL.md (seção S4.1)
# Criar 3 tabelas:
# - shared_links (links compartilhados)
# - reports_sent (histórico de relatórios)
# - report_templates (templates de relatórios)
```

**Checklist:**
- [ ] Arquivo criado em supabase/migrations/
- [ ] SQL tem RLS policies corretas
- [ ] Índices adicionados
- [ ] Tipos TypeScript atualizados em lib/supabase/types.ts

#### Passo 1.2: Atualizar tipos TypeScript
**Arquivo:** `apps/dashboard/src/lib/supabase/types.ts`

Adicionar interfaces:
```typescript
export type SharedLink = { ... }
export type ReportSent = { ... }
export type ReportTemplate = { ... }
```

**Checklist:**
- [ ] SharedLink interface completa
- [ ] ReportSent interface completa
- [ ] ReportTemplate interface completa
- [ ] Sem `any` types

---

### FASE 2: BACKEND - APIs (2-3 dias)

#### Passo 2.1: API de Geração de Token
**Arquivo:** `apps/dashboard/src/app/api/shared/generate-token/route.ts`

```typescript
POST /api/shared/generate-token
Body: {
  client_id: string,
  access_type: 'dashboard' | 'report',
  expires_in_days: number (1-365, default 30),
  password?: string,
  max_accesses?: number,
  metadata?: object
}
Response: {
  token: string,
  url: string,
  expires_at: string,
  protected: boolean
}
```

**Checklist:**
- [ ] Validação Zod completa
- [ ] Gera token aleatório (crypto.randomBytes)
- [ ] Hash de senha com bcrypt
- [ ] Salva em shared_links
- [ ] Retorna URL compartilhável
- [ ] Testes com curl/Postman

#### Passo 2.2: API de Validação de Token
**Arquivo:** `apps/dashboard/src/app/api/shared/validate/route.ts`

```typescript
POST /api/shared/validate
Body: {
  token: string,
  password?: string
}
Response: {
  client_id: string,
  client_name: string,
  access_type: string,
  valid: boolean
}
```

**Checklist:**
- [ ] Valida token (busca em shared_links)
- [ ] Valida expiração
- [ ] Valida senha (bcrypt.compare)
- [ ] Valida limite de acessos
- [ ] Incrementa access_count
- [ ] Atualiza last_accessed_at

#### Passo 2.3: Testar APIs com Postman/curl
```bash
# Testar gerar token
curl -X POST http://localhost:3000/api/shared/generate-token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"...", "access_type":"dashboard"}'

# Testar validar token
curl -X POST http://localhost:3000/api/shared/validate \
  -H "Content-Type: application/json" \
  -d '{"token":"abc123xyz"}'
```

**Checklist:**
- [ ] Gerar token funciona
- [ ] Validar token funciona
- [ ] Senha opcional funciona
- [ ] Expiração funciona
- [ ] Contador de acessos funciona

---

### FASE 3: FRONTEND - Páginas (2-3 dias)

#### Passo 3.1: Página de Validação de Senha
**Arquivo:** `apps/dashboard/src/app/shared/auth/[token]/page.tsx`

Renderiza um formulário simples:
```
┌─────────────────────────────┐
│ 🔒 Acesso Protegido         │
│                             │
│ Digite a senha:             │
│ [input password]            │
│                             │
│ [Acessar] (botão)          │
└─────────────────────────────┘
```

**Checklist:**
- [ ] Componente "use client"
- [ ] Input de senha
- [ ] Submit via fetch para /api/shared/validate
- [ ] Redireciona para /shared/dashboard/[token] se sucesso
- [ ] Mostra erro se falha
- [ ] Loading state no botão

#### Passo 3.2: Dashboard Compartilhado (Só-leitura)
**Arquivo:** `apps/dashboard/src/app/shared/dashboard/[token]/page.tsx` (Server Component)

```typescript
// Server side:
// 1. Validar token
// 2. Buscar dados do cliente (org, client)
// 3. Buscar métricas do cliente
// 4. Passar para SharedDashboardClient

// Renderizar:
<SharedDashboardClient
  client={client}
  org={org}
  metrics={metrics}
  token={token}
/>
```

**Checklist:**
- [ ] Valida token no servidor
- [ ] Redireciona se link inválido/expirado
- [ ] Busca org para marca branca
- [ ] Busca cliente e métricas
- [ ] Passa tudo para Client Component

#### Passo 3.3: Componente de Dashboard Compartilhado
**Arquivo:** `apps/dashboard/src/app/shared/dashboard/[token]/SharedDashboardClient.tsx` (Client Component)

Renderiza:
```
┌─────────────────────────────────┐
│ [Logo org] [Nome cliente]        │
│                      [Download PDF] │
├─────────────────────────────────┤
│                                 │
│ 📊 KPIs (Spend | Conversões |  │
│    ROAS | CPC | CTR)            │
│                                 │
│ 📈 Gráfico (14 dias histórico)  │
│                                 │
│ 📋 Tabela de campanhas          │
│    (apenas visualizar)          │
│                                 │
└─────────────────────────────────┘
```

**Checklist:**
- [ ] Header com marca branca (logo org, nome cliente)
- [ ] KPIs: Spend, Conversões, ROAS, CPC, CTR
- [ ] Gráfico de spend + conversões (últimos 14 dias)
- [ ] Tabela de campanhas (nome, spend, conversões, ROAS)
- [ ] Botão "Baixar PDF" (desabilitado por enquanto)
- [ ] Responsive (mobile + desktop)
- [ ] Animações com Framer Motion

---

### FASE 4: UI DO GESTOR (1-2 dias)

#### Passo 4.1: Botão "Compartilhar" no Cliente
**Arquivo:** `apps/dashboard/src/app/(dashboard)/clients/[id]/page.tsx` (MODIFICAR)

Adicionar aba "Relatórios" com:
```
┌──────────────────────────────┐
│ 📄 RELATÓRIOS                │
├──────────────────────────────┤
│                              │
│ Histórico de relatórios      │
│ (tabela vazia no início)     │
│                              │
│ [+ Enviar Relatório Agora]   │
│ [📤 Compartilhar Link]       │
│ [📧 Enviar por Email]        │
│ [📱 Enviar por WhatsApp]     │
│                              │
└──────────────────────────────┘
```

**Checklist:**
- [ ] Aba "Relatórios" criada
- [ ] Botão "+ Compartilhar Link"
- [ ] Abre modal de compartilhamento

#### Passo 4.2: Modal de Compartilhamento
**Arquivo:** `apps/dashboard/src/components/clients/ShareLinkModal.tsx` (CRIAR)

Modal com:
```
┌──────────────────────────────────┐
│ Compartilhar Dashboard           │
├──────────────────────────────────┤
│                                  │
│ ⏰ Expira em: [30 dias ▼]         │
│                                  │
│ 🔒 Proteger com senha:           │
│    [ ] Ativar                    │
│    [input: Digite a senha]       │
│                                  │
│ 👥 Limite de acessos:            │
│    [ ] Ativar                    │
│    [input: número]               │
│                                  │
│ 📊 Período:                      │
│    [Últimos 30 dias ▼]           │
│                                  │
│ ────────────────────────────────│
│ Link gerado:                     │
│ [https://startmetric.com/sh...] │
│ [📋 Copiar] [🔗 QR Code]        │
│                                  │
│ [Cancelar] [Gerar Novo]         │
└──────────────────────────────────┘
```

**Checklist:**
- [ ] Form com Zod validation
- [ ] Chama `POST /api/shared/generate-token`
- [ ] Exibe link gerado
- [ ] Botão "Copiar link" (clipboard)
- [ ] QR code (futuro)
- [ ] Loading state

#### Passo 4.3: Exibir Link Gerado
Após gerar token:
- Copiar link para clipboard
- Mostrar mensagem: "Link copiado! Compartilhe com seu cliente"
- Opção: "Enviar via WhatsApp" (futuro)
- Opção: "Enviar via Email" (futuro)

**Checklist:**
- [ ] Toast de sucesso: "Link copiado!"
- [ ] Botão "Compartilhar no WhatsApp" (abre chat)
- [ ] Botão "Enviar por Email" (desabilitado agora)

---

### FASE 5: TESTES (1 dia)

#### Passo 5.1: Testar Flow Completo
```
1. ✅ Logar como gestor (evandro@startinc.com.br)
2. ✅ Ir para /clients/[id]
3. ✅ Clicar "+ Compartilhar Link"
4. ✅ Configurar (sem senha, 30 dias)
5. ✅ Copiar link gerado
6. ✅ Abrir link em incógnito (sem login)
7. ✅ Ver dashboard só-leitura
8. ✅ Verificar marca branca (logo, cores)
9. ✅ Tentar editar (desabilitado)
10. ✅ Testar botão "Baixar PDF" (futuro)
```

#### Passo 5.2: Testar Senha
```
1. ✅ Gerar link COM senha ("123456")
2. ✅ Abrir link em incógnito
3. ✅ Deve redirecionar para /shared/auth/[token]
4. ✅ Digitar senha incorreta → erro
5. ✅ Digitar senha correta → acesso ao dashboard
```

#### Passo 5.3: Testar Expiração
```
1. ✅ Gerar link com 1 dia de expiração
2. ✅ Modificar DB manualmente: expires_at = NOW() - INTERVAL '1 day'
3. ✅ Tentar acessar link
4. ✅ Deve mostrar "Link expirado ou inválido"
```

#### Passo 5.4: Testar Limite de Acessos
```
1. ✅ Gerar link com max_accesses = 2
2. ✅ Acessar 2 vezes (funciona)
3. ✅ Terceira tentativa → erro "Limite de acessos atingido"
```

**Checklist Final:**
- [ ] Todos os fluxos testados manualmente
- [ ] Lint passa: `npm run lint`
- [ ] Typecheck passa: `npm run typecheck`
- [ ] Build passa: `npm run build`
- [ ] Nenhum console.error em produção

---

## 🚀 ROADMAP PÓS-SPRINT 4

### Sprint 5: Relatórios Automáticos (2 semanas)
- [ ] Editor de templates (drag-drop)
- [ ] Agendamento de relatórios (cron)
- [ ] Geração de PDF
- [ ] Envio automático via WhatsApp/Email

### Sprint 6: Painel Admin (2 semanas)
- [ ] `/admin/login` — Login separado
- [ ] `/admin/users` — Gestão de usuários
- [ ] `/admin/plans` — Gestão de planos
- [ ] `/admin/payments` — Stripe integration
- [ ] `/admin/analytics` — Métricas globais

### Sprint 7: IA de Análise (2-3 semanas)
- [ ] Análise automática de campanhas com Claude
- [ ] Insights + recomendações
- [ ] Comparativos por nicho
- [ ] Previsões de tendências

### Sprint 8: Portal Cliente Avançado (1-2 semanas)
- [ ] Marca branca completa
- [ ] Compartilhamento múltiplo
- [ ] Notificações em tempo real
- [ ] Assinatura digital

---

## 📦 CHECKLIST DE ENTREGA (SPRINT 4)

Quando TUDO abaixo está ✅, Sprint 4 = COMPLETO

### Banco de Dados
- [ ] Migration criada e testada
- [ ] Tabelas `shared_links`, `reports_sent`, `report_templates` existem
- [ ] Índices criados
- [ ] RLS policies funcionando
- [ ] Tipos TypeScript atualizados

### Backend APIs
- [ ] `POST /api/shared/generate-token` funciona
- [ ] `POST /api/shared/validate` funciona
- [ ] Tokens aleatórios gerados corretamente
- [ ] Senha hash com bcrypt
- [ ] Limite de acessos rastreado
- [ ] Expiração validada

### Frontend Pages
- [ ] `/shared/auth/[token]` existe e funciona
- [ ] `/shared/dashboard/[token]` existe e funciona
- [ ] Dashboard só-leitura (sem edição)
- [ ] Marca branca aplicada
- [ ] KPIs exibidos corretamente
- [ ] Gráficos renderizam

### UI do Gestor
- [ ] Aba "Relatórios" em `/clients/[id]`
- [ ] Botão "+ Compartilhar"
- [ ] Modal de compartilhamento
- [ ] Form funcional
- [ ] Link copiável
- [ ] Toast de sucesso

### Testes
- [ ] Teste de flow completo (gestor → cliente final)
- [ ] Teste de senha
- [ ] Teste de expiração
- [ ] Teste de limite de acessos
- [ ] Lint passa
- [ ] Typecheck passa
- [ ] Build passa

### Git
- [ ] Commit com mensagem descritiva
- [ ] Push para origin/main
- [ ] Tag de versão (v0.4.0)

---

## ⏱️ ESTIMATIVA DE TEMPO

| Fase | Tarefas | Horas | Dias |
|------|---------|-------|------|
| 1 | Banco de dados | 4-6 | 1 |
| 2 | Backend APIs | 6-8 | 1-2 |
| 3 | Frontend Páginas | 8-10 | 2 |
| 4 | UI do Gestor | 6-8 | 1-2 |
| 5 | Testes | 4-6 | 1 |
| **TOTAL** | — | **28-38** | **6-8** |

**Tempo estimado: 1-2 semanas** (trabalhando ~4-6 horas/dia)

---

## 📝 PRÓXIMAS AÇÕES IMEDIATAS

### Hoje (quando terminar de ler):
1. ✅ Ler este documento até o fim
2. ✅ Verificar se tem dúvidas em FASE 1-5

### Amanhã (Dia 1 - Sprint 4):
1. ⏭️ Criar arquivo migration SQL
2. ⏭️ Rodar migration no Supabase
3. ⏭️ Atualizar types.ts

### Dia 2-3 (Sprint 4):
4. ⏭️ Implementar APIs (generate-token + validate)
5. ⏭️ Testar APIs com Postman

### Dia 4-5 (Sprint 4):
6. ⏭️ Implementar páginas (auth + dashboard)
7. ⏭️ Testar navegação

### Dia 6-7 (Sprint 4):
8. ⏭️ Implementar botão + modal de compartilhamento
9. ⏭️ Testes E2E

---

## 💡 DICAS PARA NÃO FICAR TRAVADO

### Se travou na Migration:
- Consulte docs/SPRINT_4_CLIENT_PORTAL.md seção S4.1
- Teste no Supabase console direto
- Verifique RLS policies

### Se travou na API:
- Teste com curl primeiro (não use frontend)
- Verifique validação Zod
- Confirme token gerado corretamente

### Se travou no Frontend:
- Use console.log para debugar
- Teste componentes isolados
- Verifique se tipos TypeScript batem

### Se nada funciona:
- `npm run lint && npm run typecheck`
- Verifique se build passa: `npm run build`
- Considere usar git stash e recomçar a fase

---

## 🎯 OBJETIVO FINAL

**Ao fim de Sprint 4, você terá:**

```
✨ Clientes podem acessar dashboards compartilhados sem login
✨ Links com expiração, senha opcional, limite de acessos
✨ Dashboard só-leitura com marca branca do gestor
✨ Gestor consegue compartilhar com um clique
✨ Tudo pronto para relatórios automáticos (Sprint 5)
```

Bora começar? 🚀
