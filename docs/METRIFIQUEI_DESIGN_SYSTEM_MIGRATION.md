# Migração do Design System Metrifiquei para o START METRIC

> **Status:** especificação preparatória — sem autorização de implementação visual
> **Data da auditoria:** 17/10/2026
> **Projeto destino:** `apps/dashboard` do START METRIC
> **Referência visual:** `/Users/evandro/Downloads/Projeto Metrifiquei/metrifiquei-app`
> **Tarefa operacional vigente:** `NANO-005.02.01` (Last-Click). Ela permanece inalterada.

## 1. Resultado executivo

A infraestrutura visual do Metrifiquei pode ser adotada sem reescrever a arquitetura funcional do START METRIC. A estratégia segura é **compatibilidade primeiro**: incorporar tokens semânticos, fontes e padrões de componentes do Metrifiquei; adaptar esses padrões aos contratos reais do START METRIC; migrar consumidores por módulo; remover o legado somente após o mapa de uso chegar a zero.

O Metrifiquei passa a ser a **direção visual proposta** do produto:

| Documento/direção | Situação proposta |
|---|---|
| Dark Obsidian/Emerald de `docs/DESIGN.md` | Substituído como direção visual, preservado apenas como histórico |
| Start Control azul de `design/DIRECAO_START_CONTROL.md` | Substituído como direção visual, preservado apenas como histórico |
| Metrifiquei Teal | Nova fonte canônica proposta para tokens, tipografia, superfícies e componentes |

Essa substituição só se torna oficial quando a nano task documental `NANO-009.00.01` for autorizada e concluída. Até lá, `docs/DESIGN.md` e `execution/CURRENT_TASK.md` continuam sendo os contratos vigentes. Nenhum arquivo de frontend, CSS ou dependência foi alterado nesta preparação.

## 2. Diagnóstico comparativo

O START METRIC possui 23 páginas, 56 Route Handlers e 86 arquivos de componentes TypeScript/TSX. A base não deve ser reconstruída: ela já contém autenticação, sessão, escopo multi-tenant, navegação responsiva, filtros conectados a Zustand/React Query e componentes de domínio.

| Dimensão | START METRIC atual | Metrifiquei | Decisão de migração |
|---|---|---|---|
| Cores | Start Control azul, mais aliases herdados | Tokens shadcn com identidade Teal | Tornar tokens Teal semânticos a fonte principal e mapear aliases antigos durante a transição |
| Tipografia | Rubik/Poppins | Inter/JetBrains Mono | Inter para interface; JetBrains Mono apenas para IDs, slugs, códigos e valores técnicos |
| Tema | Combinação de preferências do SO, `data-theme` e classes de compatibilidade | Classe `.dark` e armazenamento local manual | Consolidar em estratégia por classe com persistência e prevenção de flash de tema |
| Primitivos | Mistura de componentes próprios e alguns pacotes Radix | shadcn/Radix mais uniforme | Portar seletivamente; não substituir todos de uma vez |
| Shell | Integrado a sessão, permissões, rotas e mobile do START METRIC | Visual limpo, mas com rotas, conta, usuário e créditos fictícios/específicos | Preservar o comportamento do shell atual e aplicar a linguagem visual do Metrifiquei |
| Conteúdo | Dados reais via APIs, React Query e Zustand | Componentes de referência com dados locais em alguns pontos | Nenhum dado ou mock do Metrifiquei entra no produto |
| Densidade | Telas de dados já densas, com tabelas e painéis de domínio | Contêiner central limitado em partes do shell | Manter variantes full-width para tabelas, dashboards e Cliente 360° |
| Responsividade | Sidebar desktop, rail intermediário e navegação mobile | Shell predominantemente desktop | Adaptar a aparência à navegação responsiva já existente |
| Estados | `EmptyState`, skeleton, erro e overlays distribuídos | Componentes compartilhados mais consistentes | Unificar o contrato de Empty/Loading/Error/Success sem apagar estados especializados |
| Acessibilidade | Há skip link, semântica e redução de movimento; cobertura é desigual | Bom ponto de partida, mas há controles sem rótulo acessível e alvos pequenos | Corrigir na adaptação e validar WCAG AA por componente e por página |

### 2.1 Divergências que impedem cópia direta

- `AppSidebar.tsx` do Metrifiquei contém rotas, workspace, suporte e progresso de onboarding próprios; o START METRIC deve continuar usando seus grupos de navegação e suas permissões.
- `AppTopbar.tsx` do Metrifiquei contém conta, usuário e créditos de IA estáticos. O START METRIC deve continuar obtendo sessão, cliente, conta, período, modo live e alertas das fontes reais.
- O alternador de tema do Metrifiquei aplica `localStorage` após hidratação e pode produzir flash de tema. A adaptação deve aplicar o tema antes da pintura e respeitar a preferência do sistema.
- Os primitivos do Metrifiquei usam o pacote agregado `radix-ui` e o pacote `cn`; o START METRIC já usa pacotes Radix individuais e possui `cn` em `src/lib/utils.ts` com `clsx` e `tailwind-merge`.
- O `max-w-7xl` do shell de referência não atende todas as tabelas e matrizes do START METRIC. O contêiner precisa de variantes por tipo de tela.
- O Teal claro original usa foreground `#fafafa` sobre `#008382`, combinação com contraste aproximado de 4,40:1, abaixo do mínimo de 4,5:1 para texto normal. O token interativo claro deve usar Teal mais escuro (recomendação inicial `#007d7c`) ou outra combinação validada.
- Os componentes do Metrifiquei usam alturas compactas que podem ficar abaixo de 44 px. Em 390 px, controles de toque devem manter alvo mínimo de 44 × 44 px sem perder densidade no desktop.

## 3. Inventário de reutilização

### 3.1 Arquivos do Metrifiquei

| Referência | Classificação | Adaptação necessária no START METRIC |
|---|---|---|
| `src/app/globals.css` | Reutilizar o contrato, não copiar integralmente | Portar tokens Teal, claro/escuro e raios; preservar aliases usados; manter redução de movimento e estilos funcionais do destino |
| `src/components/layout/AppShell.tsx` | Referência estrutural | Preservar `QueryProvider`, tracking, overlay global, sessão server-side, skip link e variantes full-width |
| `src/components/layout/AppSidebar.tsx` | Referência visual | Usar rotas, grupos, permissões, diagnóstico e dados reais do START METRIC; excluir onboarding e suporte fictícios |
| `src/components/layout/AppTopbar.tsx` | Referência visual | Preservar filtros reais, alertas, logout, Zustand e React Query; excluir créditos e identidade estáticos |
| `src/components/shared/PageHeader.tsx` | Reutilizável com adaptação leve | Tipar ações, breadcrumbs e responsividade; padronizar hierarquia sem alterar títulos de domínio |
| `src/components/shared/FilterBar.tsx` | Reutilizável com adaptação | Suportar slots, labels acessíveis, filtros controlados e estados de URL/store; botões de visualização precisam de nome acessível |
| `src/components/shared/EntityDrawer.tsx` | Reutilizável com adaptação relevante | Integrar permissões, mutações reais, foco, confirmação de alterações pendentes e fechamento seguro |
| `src/components/shared/EmptyState.tsx` | Reutilizável por compatibilidade | Mesclar com a API atual para não quebrar consumidores; manter ação opcional e contexto de ausência real |
| `src/components/shared/ResourceCard.tsx` | Padrão reutilizável | Vincular a integrações e recursos reais; remover conteúdo demonstrativo e estados inventados |
| `src/components/shared/PlanBadge.tsx` | Padrão reutilizável | Mapear planos/entitlements reais; harmonizar com `ComingSoonBadge` sem confundir plano com disponibilidade |
| `src/components/shared/StatusPill.tsx` | Reutilizável após tipagem | Substituir `string` livre por unions/mapas de domínio; status desconhecido não pode virar `pending` silenciosamente |
| `src/components/ui/*` | Portar seletivamente | Adaptar imports para `@/lib/utils`, dependências individuais e padrões do monorepo; evitar duplicação de primitivos existentes |

### 3.2 Componentes e contratos do START METRIC que devem ser preservados

- Layout raiz, providers de React Query, bootstrap de tracking e overlay global.
- Layout autenticado com identidade obtida no servidor e isolamento de tenant.
- `Sidebar`, `Header`, `MobileNav`, `nav-items` e seus contratos de rota/permissão, mesmo quando a marcação visual for refatorada.
- `DashboardControls` e sua ligação a cliente, conta, intervalo, comparação e modo live; o `<select>` longo pode virar combobox pesquisável, mas a fonte de dados e o estado permanecem.
- Componentes de domínio como KPIs, gráficos, tabelas, Meta UI, relatórios, alertas, Garimpo, Cliente 360° e formulários.
- `StateBoundary`, skeletons, error alerts, toasts e overlays com semântica funcional já existente.
- APIs, Route Handlers, Supabase, RLS, autenticação, Meta Ads, Stripe, WhatsApp, tracking, React Query e Zustand.
- Regra de ausência: `null`, `undefined` e ausência devem aparecer como `—`; não podem ser convertidos em zero.
- Fórmulas financeiras e métricas calculadas permanecem exclusivamente no backend.

### 3.3 Mapa inicial de consumidores

O mapa foi levantado antes de qualquer proposta de remoção:

| Componente atual | Consumidores diretos encontrados |
|---|---:|
| `Badge` | 8 |
| `Button` | 16, além de imports pelo índice de UI |
| `Tabs` | 1 direto, além de imports pelo índice de UI |
| `EmptyState` | 3 diretos, além de imports pelo índice de UI |
| `StatCard` | 4 |
| `Skeleton` | 8 |
| `ErrorAlert` | 1 |
| `ComingSoonBadge` | 2 |

Os consumidores indiretos via `components/ui/index.ts` também precisam ser resolvidos com `rg` em cada nano task. Zero import direto não autoriza exclusão: exports agregados e imports dinâmicos devem ser verificados. Nenhum componente visual atual será apagado antes de o mapa completo registrar zero consumidores e de a alternativa ter testes equivalentes.

## 4. Dependências

### 4.1 Adições propostas

As versões exatas devem ser resolvidas na nano task de dependências, mantendo compatibilidade com Next 16, React 19 e o lockfile atual.

| Dependência | Motivo |
|---|---|
| `next-themes` | Tema por classe, persistência, preferência do sistema e prevenção de flash/hidratação divergente |
| `tw-animate-css` | Animações usadas pelos padrões shadcn com suporte a redução de movimento |
| `@radix-ui/react-avatar` | Avatar acessível do shell |
| `@radix-ui/react-dropdown-menu` | Menus da topbar e ações |
| `@radix-ui/react-popover` | Filtros e seletores compactos |
| `@radix-ui/react-select` | Selects acessíveis onde busca não for necessária |
| `@radix-ui/react-separator` | Separadores semânticos |
| `@radix-ui/react-switch` | Controles booleanos, incluindo modo live quando aplicável |
| `@radix-ui/react-tooltip` | Tooltips acessíveis de navegação compacta |
| `cmdk` | Combobox pesquisável para listas extensas de clientes e contas |
| `@axe-core/playwright` (dev, recomendado) | Auditoria automatizada de acessibilidade nas rotas prioritárias |

O pacote `@radix-ui/react-dialog` já existente pode sustentar `Dialog` e `Sheet`; não se deve introduzir duas implementações concorrentes sem necessidade.

### 4.2 Dependências que não devem ser copiadas automaticamente

- `cn`: o destino já possui helper equivalente e integrado ao Tailwind Merge.
- `radix-ui` agregado: preferir os pacotes individuais já adotados no projeto.
- `shadcn` como dependência de runtime: usar o CLI apenas como ferramenta de geração, se necessário.
- Upgrades de Next, React, Zod ou Lucide: não pertencem à migração visual e exigem tarefas próprias.

Também será criado `apps/dashboard/components.json` apenas na nano task autorizada de dependências/configuração.

## 5. Riscos de regressão

| Risco | Nível | Mitigação obrigatória |
|---|---|---|
| Perder sessão, tenant ou permissões ao trocar o shell | Crítico | Adaptar o shell atual; testes de acesso e troca de contexto antes/depois |
| Alterar filtros, cache ou queries ao redesenhar controles | Alto | Manter hooks, query keys, stores e payloads; trocar apenas apresentação |
| Converter ausência em zero em KPIs | Alto | Testes explícitos para `null`/`undefined`/vazio exibindo `—`; não criar formatador paralelo |
| Reintroduzir fórmulas financeiras no cliente | Alto | Componentes apenas renderizam valores fornecidos pelo backend |
| Quebrar rotas ao copiar navegação do Metrifiquei | Alto | `NAV_GROUPS` e rotas do START METRIC são fonte única; teste de links mortos |
| Flash de tema ou erro de hidratação | Médio | Provider de tema, atributo por classe, script pré-pintura e teste SSR/hidratação |
| Contraste insuficiente do Teal original | Médio | Ajustar token e medir contraste; não validar apenas visualmente |
| Regressão em tabelas densas | Médio | Variantes full-width, sticky/scroll interno e testes em 1440/834/390 |
| Dependências duplicadas ou incompatíveis | Médio | Nano task isolada, lockfile revisado, typecheck e testes antes de portar componentes |
| Remoção prematura de componentes atuais | Alto | Mapa de consumidores por `rg`, depreciação, migração completa e só então limpeza |
| Confundir mocks do Metrifiquei com produto real | Alto | Proibir strings/dados demonstrativos; fixtures somente em testes |
| Dificuldade de atribuir regressões no worktree atual | Alto | Inventariar e isolar as 178 entradas locais antes da primeira alteração de código visual |

Há ainda um risco técnico preexistente: `src/lib/utils.ts` usa testes falsy em alguns formatadores, o que pode confundir ausência e zero. Esse comportamento não será alterado incidentalmente numa tarefa visual; deve ser coberto ou corrigido em nano task funcional autorizada.

## 6. Plano sequencial por nano tasks

Somente uma nano task pode ficar em execução. Toda tarefa abre com diff/consumer map do escopo e fecha com validação proporcional ao risco.

| Ordem | Nano task | Entrega |
|---:|---|---|
| 0 | `PREPARATION-NANO-009` | Auditoria, inventário e proposta desta especificação — concluída sem alterar frontend |
| 1 | `NANO-009.00.01` | Tornar Metrifiquei Teal o contrato visual canônico e marcar as duas direções anteriores como históricas |
| 2 | `NANO-009.00.02` | Registrar baseline reproduzível, separar alterações locais e zerar o lint preexistente sem mudança visual |
| 3 | `NANO-009.01.01` | Configurar shadcn e instalar somente dependências aprovadas |
| 4 | `NANO-009.01.02` | Introduzir Inter, JetBrains Mono, provider de tema e tokens Teal com camada de aliases compatíveis |
| 5 | `NANO-009.02.01` | Portar primitivos Radix/shadcn essenciais com testes de teclado/foco |
| 6 | `NANO-009.02.02` | Adaptar PageHeader, FilterBar, EmptyState, StatusPill, PlanBadge, ResourceCard e contrato unificado de estados |
| 7 | `NANO-009.03.01` | Migrar AppShell e Sidebar preservando sessão, permissões, rotas e larguras por tipo de página |
| 8 | `NANO-009.03.02` | Migrar Topbar, tema e navegação mobile preservando filtros e logout |
| 9 | `NANO-009.04.01` | Substituir selects extensos de cliente/conta por combobox pesquisável sem alterar store/hooks |
| 10 | `NANO-009.04.02` | Migrar Dashboard, KPIs, gráficos e tabelas; validar `—` para ausência |
| 11 | `NANO-009.05.01` | Migrar lista, busca e estados de Clientes |
| 12 | `NANO-009.05.02` | Migrar Cliente 360°, drawers e formulários com permissões e dirty-state |
| 13 | `NANO-009.06.01` | Migrar Performance e Campanhas |
| 14 | `NANO-009.06.02` | Migrar Criativos, análises horárias e diagnósticos |
| 15 | `NANO-009.07.01` | Migrar Relatórios: lista, filtros, status e histórico |
| 16 | `NANO-009.07.02` | Migrar editor e drawer de Relatórios |
| 17 | `NANO-009.08.01` | Migrar Alertas, regras, triagem e painéis laterais |
| 18 | `NANO-009.09.01` | Migrar Garimpo |
| 19 | `NANO-009.09.02` | Migrar Integrações e Configurações |
| 20 | `NANO-009.09.03` | Harmonizar superfícies de autenticação, administração e páginas compartilhadas |
| 21 | `NANO-009.10.01` | Remover apenas aliases/componentes legados com zero consumidores comprovados |
| 22 | `NANO-009.10.02` | Validação final, acessibilidade, links, documentação, changelog, status e handoff ECC |

`NANO-005.02.01` deve estar concluída ou formalmente adiada pelo proprietário antes de autorizar `NANO-009.00.01`. Nenhuma tarefa acima autoriza alteração de regra de negócio.

## 7. Escopo exato da primeira nano task

### `NANO-009.00.01` — Canonizar o contrato visual Metrifiquei Teal

**ALLOWED FILES**

- `docs/DESIGN.md`
- `docs/RULES.md`
- `docs/DECISIONS.md`
- `docs/METRIFIQUEI_DESIGN_SYSTEM_MIGRATION.md`
- `design/DIRECAO_START_CONTROL.md`
- `execution/TASK_QUEUE.md`
- `state/CHANGELOG.md`
- `state/STATUS.md`
- `state/HANDOFF.md`

**FORBIDDEN FILES**

- `execution/CURRENT_TASK.md` durante a execução da nano task (a autorização deve existir antes do início)
- `AGENTS.md`
- `PRD.md`
- `apps/**`
- `packages/**`
- `supabase/**`
- `e2e/**`
- `public/**`
- `package.json`
- `package-lock.json`
- `apps/dashboard/package.json`
- `apps/dashboard/components.json`
- `.env*`
- Qualquer arquivo não listado expressamente em **ALLOWED FILES**

Essa primeira nano task é exclusivamente documental. Ela não instala dependências, não altera tokens e não muda uma única linha do frontend.

## 8. Critérios de aceite

### 8.1 Visuais

- Metrifiquei Teal declarado como fonte canônica; Dark Obsidian/Emerald e Start Control azul declarados históricos, sem ambiguidade normativa.
- Tokens semânticos para background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, success e warning em claro/escuro.
- Inter aplicada à interface e JetBrains Mono somente a valores técnicos.
- Densidade SaaS B2B preservada com hierarquia, alinhamento e espaçamento consistentes.
- Empty, Loading, Error e Success definidos para todas as telas relevantes, sem dados decorativos.
- Status não comunicados apenas por cor.

### 8.2 Funcionais e técnicos

- Nenhuma mudança de rota, Route Handler, contrato de API, schema, RLS, autenticação ou isolamento de tenant.
- Nenhuma mudança em query keys, hooks, stores, integrações ou fórmulas.
- Ausência continua sendo `—`; zero real continua sendo `0` formatado conforme o domínio.
- Nenhum mock ou dado inventado em produção.
- Nenhum `any` novo.
- Typecheck com zero erros, lint com zero erros e todos os testes existentes aprovados em cada nano task de código.
- Sem links mortos, imports órfãos ou componentes removidos com consumidores.
- Apenas arquivos autorizados alterados; `git diff --check` aprovado.
- Changelog, status e handoff atualizados conforme ECC ao concluir cada nano task.

Para a nano task documental inicial, os gates de código são **não aplicáveis porque nenhum código muda**; exigem-se validação de links/referências, `git diff --check` e confirmação de zero diff em `apps/**`, `packages/**`, manifests e lockfile.

### 8.3 Responsivos

| Viewport | Critério mínimo |
|---|---|
| 1440 px | Sidebar completa, topbar sem colisões, dashboard/tabelas em variante densa e popovers dentro do viewport |
| 834 px | Rail ou navegação compacta funcional, filtros quebrando linha sem sobreposição, drawers dimensionados e tabelas com scroll interno controlado |
| 390 px | Navegação inferior/drawer funcional, nenhum overflow do viewport, ações principais alcançáveis, controles de toque com pelo menos 44 × 44 px e tabelas adaptadas ou com scroll interno sinalizado |

### 8.4 Acessibilidade

- Contraste WCAG AA medido para texto, ícones essenciais, foco e estados interativos nos dois temas.
- Navegação integral por teclado, foco visível, ordem lógica, `Escape` em overlays e focus trap em dialog/drawer.
- Inputs, selects, comboboxes e botões de ícone têm nome acessível.
- Erros são associados aos campos e anunciados; loading e success usam live regions quando necessário.
- `prefers-reduced-motion` respeitado.

## 9. Regra de implementação

O Design System é uma camada de apresentação. Se uma adaptação exigir mudar payload, cálculo, autorização, isolamento de tenant ou regra de negócio, a nano task visual deve parar e abrir uma proposta funcional separada. Fidelidade ao Metrifiquei nunca prevalece sobre segurança, dados reais ou comportamento já contratado do START METRIC.
