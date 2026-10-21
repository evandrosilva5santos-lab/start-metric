# CHANGELOG.md — Registro Cronológico de Alterações

| Data | Agente | Nano Task | Arquivos Alterados | Descrição da Alteração | Método de Validação | Resultado |
|---|---|---|---|---|---|---|
| **28/09/2026** | Antigravity | `PREPARATION` | `docs/*`, `execution/*`, `state/*`, `reports/*`, `PRD_TRACEABILITY.md` | Estruturação determinística, auditoria de 47 rotas e preparação para execução autônoma do Claude Code | `npm run typecheck` + Auditoria cruzada | `PASS / READY_FOR_EXECUTION` |
| **25/09/2026** | Evandro | `NANO-003.01.01` | `apps/dashboard/src/app/api/meta/contas/` | Correção de sessão em getDashboardSession e filtro de contas Meta por Business Manager | Teste manual no browser | `PASS` |
| **25/09/2026** | Evandro | `NANO-004.01.01` | `apps/dashboard/src/lib/garimpo/` | Implementação de signals de longevidade, blindagem e aceleração com testes unitários | `npm run test:garimpo` | `PASS (7/7)` |

### [PREPARATION-NANO-009] - 2026-10-17

- **Added:** especificação `docs/METRIFIQUEI_DESIGN_SYSTEM_MIGRATION.md` com diagnóstico, inventário, riscos, dependências, critérios de aceite e decomposição sequencial da migração visual.
- **Added:** proposta não autorizada `execution/proposals/CURRENT_TASK-NANO-009.00.01.md` para canonização documental do Metrifiquei Teal.
- **Preserved:** `execution/CURRENT_TASK.md` continua autorizando exclusivamente `NANO-005.02.01`; nenhum frontend, CSS, manifest, lockfile ou regra de negócio foi alterado.
- **Validation:** auditoria estática dos dois projetos, mapa inicial de consumidores e `git diff --check` nos arquivos desta preparação.

### [NANO-009.00.01] - 2026-10-17

- **Changed:** `docs/DESIGN.md` agora define Metrifiquei Teal, Inter, JetBrains Mono, temas claro/escuro, componentes shadcn/Radix, estados e breakpoints 1440/834/390 como contrato canônico.
- **Changed:** `docs/RULES.md` e `docs/DECISIONS.md` registram WCAG 2.2 AA, ausência como `—` e ADR-007.
- **Deprecated:** `design/DIRECAO_START_CONTROL.md` foi marcado como histórico; seu conteúdo foi preservado.
- **Governance:** Last-Click foi adiado, não cancelado, por autorização do proprietário; EPIC-009 foi colocada em execução sequencial.
- **Validation:** referências locais e whitespace documental verificados; nenhum arquivo em `apps/**`, `packages/**`, manifests ou lockfile foi alterado por esta nano task.

### [NANO-009.00.02] - 2026-10-17

- **Fixed:** removidos 11 erros e 6 avisos ESLint preexistentes por meio de tipagem das sessões/linhas Supabase e limpeza de imports sem uso.
- **Preserved:** APIs, autenticação, tenant, payload Stripe e regras de clientes permaneceram funcionalmente iguais.
- **Validation:** `npm run typecheck --workspace=start-metric` PASS; `npm run lint --workspace=start-metric` PASS; Garimpo 7/7, Relatórios 64/64 e Alertas 18/18 PASS.

### [NANO-009.01.01] - 2026-10-17

- **Added:** `next-themes`, `tw-animate-css`, `cmdk` e pacotes Radix individuais aprovados.
- **Added:** `apps/dashboard/components.json` com aliases do monorepo e estilo `radix-nova`.
- **Preserved:** versões existentes de Next, React, Zod e Lucide.
- **Validation:** instalação concluída sem conflito; typecheck e lint aprovados.

### [NANO-009.01.02] - 2026-10-17

- **Changed:** tokens do frontend agora usam Metrifiquei Teal em claro/escuro com aliases compatíveis para os consumidores existentes.
- **Changed:** Inter substitui Rubik/Poppins e JetBrains Mono foi adicionada para conteúdo técnico.
- **Added:** `ThemeProvider` persistido por classe com preferência do sistema e hidratação segura.
- **Accessibility:** removido o bloqueio de zoom do viewport.
- **Validation:** typecheck e lint aprovados.

### [NANO-009.02.01] - 2026-10-17

- **Changed:** Button, Badge, Card, Table, Dialog e Tabs alinhados ao contrato shadcn/Radix sem quebrar variantes legadas.
- **Added:** Avatar, Command, DropdownMenu, Popover, Select, Separator, Sheet, Switch e Tooltip.
- **Accessibility:** dialogs, sheets, menus, tabs e selects usam gerenciamento de foco e teclado do Radix; alvos mobile foram preservados.
- **Validation:** typecheck e lint aprovados.

### [NANO-009.02.02] - 2026-10-17

- **Added:** PageHeader, FilterBar, EntityDrawer, ResourceCard, PlanBadge e StatusPill adaptados ao START METRIC.
- **Changed:** EmptyState e ComingSoonBadge foram simplificados e mantiveram contratos compatíveis, sem textos decorativos.
- **Accessibility:** busca rotulada, view switch com `aria-pressed`, drawer com foco Radix e fechamento seguro para dirty-state.
- **Validation:** typecheck e lint aprovados.

### [NANO-010.00.01] - 2026-10-17

- **Added:** regra canônica “a integração descobre; a Carteira autoriza; a operação exibe somente autorizadas” no PRD e arquitetura.
- **Added:** ADR-008 e regras de validação server-side, escopo por organização/cliente e semântica de “Todas as contas”.
- **Governance:** EPIC-010 decomposta em seis nano tasks, sem alteração visual nesta etapa documental.

### [NANO-010.01.01] - 2026-10-17

- **Added:** política pura e fonte server-side única para contas operacionais autorizadas.
- **Fixed:** `/api/meta/contas`, `/api/meta/accounts`, `/api/meta/dados`, `/api/meta/insights`, mutações de campanha e rollup da Visão Geral deixaram de aceitar contas apenas descobertas, desvinculadas, inativas, arquivadas ou fora do tenant.
- **Security:** tokens de ambiente ou cifrados só são usados depois da autorização local; cache inclui organização e cliente; consultas de campanhas e métricas incluem `org_id`.
- **Validation:** typecheck e lint sem erros; autorização 7/7, Garimpo 7/7, Relatórios 64/64, Alertas 18/18 e Meta action map 5/5 aprovados.

### [NANO-010.02.01] - 2026-10-17

- **Changed:** filtros operacionais seguem Cliente → Plataforma → Conta → Período e enviam o escopo completo à API.
- **Added:** combobox pesquisável e acessível para cliente e conta, com ID técnico em JetBrains Mono.
- **Fixed:** `NO_CLIENT` foi removido do painel e seleções persistidas incompatíveis são descartadas atomicamente.
- **Preserved:** hidratação manual, React Query, polling, retomada do PWA e ocultação de valores.
- **Validation:** autorização/seleção 9/9, typecheck e lint aprovados.

### [NANO-010.03.01] - 2026-10-17

- **Fixed:** Relatórios não aceitam mais conta solta; criação, geração, preview e seleção de partes usam apenas contas ativas do cliente não arquivado.
- **Fixed:** Alertas validam cliente/conta/campanha contra o inventário operacional e o monitor filtra campanhas mesmo em regras com ID direto.
- **Changed:** opções de escopo dos Alertas mostram somente contas autorizadas.
- **Validation:** Relatórios 64/64, Alertas 18/18, autorização 9/9, typecheck e lint aprovados.

### [NANO-010.04.01] - 2026-10-17

- **Added:** migration com FK same-org, unicidade por plataforma, view `operational_ad_accounts` e RPC transacional com `FOR UPDATE`.
- **Security:** APIs e páginas de Cliente 360° agora filtram explicitamente `org_id` mesmo sob service role.
- **Changed:** reatribuição exige confirmação explícita e o painel apresenta uma segunda ação destrutiva; desvínculo retira imediatamente a conta da operação.
- **Fixed:** arquivar cliente preserva `client_id`, campanhas e métricas históricas.
- **Validation:** teste estático da migration e política 10/10, typecheck e lint aprovados.

### [NANO-005.01.01-FIX] - 2026-09-28
- **Fixed:** Atualizada `apiVersion` do Stripe para `"2026-08-26.dahlia"` em `apps/dashboard/src/app/api/webhooks/stripe/route.ts` para resolver bloqueio TS2322.
- **Fixed:** Resolvidos os bloqueios de schema de atribuição (`click_id`, `attribution_fbc`, `attribution_fbp` adicionados) em `packages/types/src/orders.ts`.
- **Added:** Adicionadas chaves de teste da API do Stripe no `.env`.
- **Verified:** Build validation `npm run typecheck` completada com 0 erros.
| **28/09/2026** | Claude | `NANO-005.01.01` | `apps/dashboard/src/app/api/webhooks/stripe/route.ts`, `packages/types/src/orders.ts` | Correção tipagem (Stripe apiVersion) e atualização schema Zod para incluir campos de atribuição. | `npm run typecheck` | `PASS (0 errors)` |
